"""Application state with SQLite persistence for products and attributes."""

import json
from pathlib import Path

from models.product import Product
from models.attribute import AttributeDefinition
from services.database import (
    init_db, load_all_products, save_product,
    delete_product as db_delete_product, delete_all_products,
    load_all_templates, save_template as db_save_template, delete_template as db_delete_template,
    load_all_attribute_definitions, save_attribute_definition,
    delete_attribute_definition as db_delete_attribute_definition,
    delete_all_attribute_definitions as db_delete_all_attribute_definitions,
    count_attribute_definitions,
    get_app_metadata, set_app_metadata,
    load_all_suppliers, create_supplier as db_create_supplier,
    update_supplier as db_update_supplier, delete_supplier as db_delete_supplier,
    save_supplier_articlewerk_result as db_save_supplier_articlewerk_result,
    upsert_articlewerk_supplier as db_upsert_articlewerk_supplier,
)

DATA_DIR = Path(__file__).parent / "data"
ATTRIBUTE_SEED_MARKER = "attribute_definitions_seeded"


class AppState:
    def __init__(self) -> None:
        self.products: dict[str, Product] = {}
        self.attribute_config: dict[str, AttributeDefinition] = {}
        self.templates: dict[str, dict] = {}
        self._category_tree: dict = {}
        init_db()
        self._load_attribute_config()
        self.products = load_all_products()
        self.templates = load_all_templates()
        self._seed_default_templates()
        self._load_category_tree()

    def reload_from_db(self) -> None:
        """Re-read all data from SQLite into memory."""
        self._load_attribute_config()
        self.products = load_all_products()
        self.templates = load_all_templates()
        self._load_category_tree()

    def _load_attribute_config(self) -> None:
        """Load definitions, using the bundled JSON only on the first-ever start."""
        if get_app_metadata(ATTRIBUTE_SEED_MARKER) != "1":
            if count_attribute_definitions() == 0:
                self._seed_attributes_from_json()
            set_app_metadata(ATTRIBUTE_SEED_MARKER, "1")
        self.attribute_config = load_all_attribute_definitions()

    def _seed_attributes_from_json(self) -> None:
        """One-time migration: seed attribute_definitions table from JSON."""
        config_path = DATA_DIR / "attribute_config.json"
        if not config_path.exists():
            return
        raw = json.loads(config_path.read_text(encoding="utf-8-sig"))
        for idx, (key, entry) in enumerate(raw.items()):
            attr = AttributeDefinition(**entry)
            save_attribute_definition(key, attr, sort_order=idx)

    # --- Attribute config CRUD ---

    def add_attribute_definition(self, key: str, attr: AttributeDefinition) -> None:
        max_order = len(self.attribute_config)
        save_attribute_definition(key, attr, sort_order=max_order)
        self.attribute_config[key] = attr

    def update_attribute_definition(self, key: str, attr: AttributeDefinition) -> None:
        save_attribute_definition(key, attr)
        self.attribute_config[key] = attr

    def remove_attribute_definition(self, key: str) -> bool:
        if key in self.attribute_config:
            del self.attribute_config[key]
            db_delete_attribute_definition(key)
            return True
        return False

    def clear_attribute_definitions(self) -> int:
        """Delete all definitions without touching product or template values."""
        deleted = db_delete_all_attribute_definitions()
        self.attribute_config.clear()
        set_app_metadata(ATTRIBUTE_SEED_MARKER, "1")
        return deleted

    def delete_product(self, artikelnummer: str) -> bool:
        if artikelnummer in self.products:
            del self.products[artikelnummer]
            db_delete_product(artikelnummer)
            return True
        return False

    def clear_products(self) -> None:
        self.products.clear()
        delete_all_products()

    def add_product(self, product: Product) -> None:
        self.products[product.artikelnummer] = product
        save_product(product)

    def get_product(self, artikelnummer: str) -> Product | None:
        return self.products.get(artikelnummer)

    def get_all_products(self) -> list[Product]:
        return sorted(self.products.values(), key=lambda p: p.artikelnummer.lower())

    def get_active_products(self) -> list[Product]:
        return sorted(
            (p for p in self.products.values() if not p.exported),
            key=lambda p: p.artikelnummer.lower(),
        )

    def get_archived_products(self) -> list[Product]:
        return sorted(
            (p for p in self.products.values() if p.exported),
            key=lambda p: p.artikelnummer.lower(),
        )

    def archive_product(self, artikelnummer: str) -> None:
        p = self.products.get(artikelnummer)
        if p:
            p.exported = True
            save_product(p)

    def unarchive_product(self, artikelnummer: str) -> None:
        p = self.products.get(artikelnummer)
        if p:
            p.exported = False
            save_product(p)

    def save_product_changes(self, product: Product) -> None:
        """Persist current product state to DB (call after attribute changes)."""
        save_product(product)

    # --- Suppliers ---

    def get_suppliers(self) -> list[dict]:
        return load_all_suppliers()

    def get_supplier(self, supplier_id: int) -> dict | None:
        return next((supplier for supplier in load_all_suppliers() if supplier["id"] == supplier_id), None)

    def create_supplier(self, data: dict) -> dict:
        return db_create_supplier(data)

    def update_supplier(self, supplier_id: int, data: dict) -> tuple[dict | None, str | None]:
        supplier, old_name = db_update_supplier(supplier_id, data)
        if supplier and old_name:
            for product in self.products.values():
                if (product.lieferant_name or "").lower() == old_name.lower():
                    product.lieferant_name = data["name"]
        return supplier, old_name

    def save_supplier_articlewerk_result(
        self, supplier_id: int, *, remote_id: str | None = None, revision: str | None = None,
        error: str | None = None,
    ) -> dict | None:
        return db_save_supplier_articlewerk_result(
            supplier_id, remote_id=remote_id, revision=revision, error=error,
        )

    def upsert_articlewerk_supplier(self, remote: dict) -> tuple[dict, bool]:
        before = self.get_supplier(next(
            (item["id"] for item in self.get_suppliers()
             if item.get("articlewerk_supplier_id") == str(remote["id"])
             or (item.get("supplier_number") or "").casefold() == str(remote["supplierNumber"]).casefold()),
            -1,
        ))
        supplier, created = db_upsert_articlewerk_supplier(remote)
        if before and before["name"] != supplier["name"]:
            for product in self.products.values():
                if (product.lieferant_name or "").casefold() == before["name"].casefold():
                    product.lieferant_name = supplier["name"]
        return supplier, created

    def delete_supplier(self, supplier_id: int) -> tuple[bool, str | None, int]:
        return db_delete_supplier(supplier_id)

    # --- Variants ---

    def get_variants(self, parent_sku: str) -> list[Product]:
        """Return all child products of a given parent."""
        return [p for p in self.products.values() if p.parent_sku == parent_sku]

    def get_variant_group(self, sku: str) -> dict | None:
        """Return {parent: Product, children: [Product]} for a variant group."""
        product = self.products.get(sku)
        if not product:
            return None
        if product.is_parent:
            parent = product
        elif product.parent_sku:
            parent = self.products.get(product.parent_sku)
            if not parent:
                return None
        else:
            return None
        children = self.get_variants(parent.artikelnummer)
        return {"parent": parent, "children": children}

    def resolve_product(self, product: Product, inherit_fields: list[str] | None = None) -> Product:
        """Return a copy with inherited parent fields where own value is empty/None."""
        if not product.parent_sku:
            return product
        parent = self.products.get(product.parent_sku)
        if not parent:
            return product
        if inherit_fields is None:
            from routers.settings import get_varianten_settings
            inherit_fields = get_varianten_settings().get("inherit_fields", [])
        data = product.model_dump()
        for field in inherit_fields:
            val = data.get(field)
            if val is None or val == "":
                parent_val = getattr(parent, field, None)
                if parent_val is not None and parent_val != "":
                    data[field] = parent_val
        return Product(**data)

    # --- Templates ---

    def _seed_default_templates(self) -> None:
        """Create default templates if they don't exist yet."""
        if "GPSR" not in self.templates:
            gpsr_attrs: dict[str, str | int | bool] = {
                "meta_gpsr_hersteller": "",
                "meta_gpsr_strase": "",
                "meta_gpsr_ort": "",
                "meta_gpsr_land": "",
                "meta_gpsr_mail": "",
            }
            self.templates["GPSR"] = {
                "attributes": gpsr_attrs,
                "category": "Compliance",
                "description": "GPSR-Pflichtangaben für Hersteller/Import.",
            }
            db_save_template("GPSR", gpsr_attrs, "Compliance", "GPSR-Pflichtangaben für Hersteller/Import.")

    def get_templates(self) -> dict[str, dict]:
        return self.templates

    def get_template(self, name: str) -> dict | None:
        return self.templates.get(name)

    def set_template(
        self,
        name: str,
        attributes: dict[str, str | int | bool],
        category: str = "",
        description: str = "",
    ) -> None:
        self.templates[name] = {
            "attributes": attributes,
            "category": category,
            "description": description,
        }
        db_save_template(name, attributes, category, description)

    def remove_template(self, name: str) -> bool:
        if name in self.templates:
            del self.templates[name]
            db_delete_template(name)
            return True
        return False

    def rename_template(self, old_name: str, new_name: str) -> bool:
        """Rename a template. Returns False if old missing, new exists or name invalid."""
        new_name = new_name.strip()
        if not new_name or old_name == new_name:
            return False
        if old_name not in self.templates or new_name in self.templates:
            return False
        data = self.templates.pop(old_name)
        self.templates[new_name] = data
        db_delete_template(old_name)
        db_save_template(new_name, data["attributes"], data.get("category", ""), data.get("description", ""))
        return True

    def clone_template(self, source_name: str, new_name: str) -> bool:
        """Duplicate an existing template under a new name."""
        new_name = new_name.strip()
        if not new_name or new_name in self.templates:
            return False
        source = self.templates.get(source_name)
        if source is None:
            return False
        attrs_copy = dict(source.get("attributes", {}))
        category = source.get("category", "")
        description = source.get("description", "")
        self.templates[new_name] = {
            "attributes": attrs_copy,
            "category": category,
            "description": description,
        }
        db_save_template(new_name, attrs_copy, category, description)
        return True

    def get_template_categories(self) -> list[str]:
        """Return sorted list of distinct non-empty template categories."""
        cats = {t.get("category", "") for t in self.templates.values() if t.get("category")}
        return sorted(cats, key=lambda s: s.lower())

    # --- Category tree ---

    def _load_category_tree(self) -> None:
        path = DATA_DIR / "category_tree.json"
        if path.exists():
            self._category_tree = json.loads(path.read_text(encoding="utf-8"))
        else:
            self._category_tree = {}

    def get_category_tree(self) -> dict:
        return self._category_tree

    def save_category_tree(self, tree: dict) -> None:
        self._category_tree = tree
        path = DATA_DIR / "category_tree.json"
        path.write_text(json.dumps(tree, ensure_ascii=False, indent=2), encoding="utf-8")

    def get_category_children(self, path: list[str]) -> list[str] | None:
        node = self._category_tree
        for segment in path:
            if segment not in node:
                return None
            node = node[segment]
        return sorted(node.keys())


state = AppState()
