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
    count_attribute_definitions,
)

DATA_DIR = Path(__file__).parent / "data"


class AppState:
    def __init__(self) -> None:
        self.products: dict[str, Product] = {}
        self.attribute_config: dict[str, AttributeDefinition] = {}
        self.templates: dict[str, dict[str, str | int | bool]] = {}
        init_db()
        self._load_attribute_config()
        self.products = load_all_products()
        self.templates = load_all_templates()
        self._seed_default_templates()

    def _load_attribute_config(self) -> None:
        """Load attributes from DB, seeding from JSON on first run."""
        if count_attribute_definitions() == 0:
            self._seed_attributes_from_json()
        else:
            self._sync_attributes_from_json()
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

    def _sync_attributes_from_json(self) -> None:
        """Sync sort order, categories, names, IDs, suggested_values, and descriptions from JSON into DB."""
        config_path = DATA_DIR / "attribute_config.json"
        if not config_path.exists():
            return
        raw = json.loads(config_path.read_text(encoding="utf-8-sig"))
        db_attrs = load_all_attribute_definitions()
        for idx, (key, entry) in enumerate(raw.items()):
            json_attr = AttributeDefinition(**entry)
            if key not in db_attrs:
                # New attribute from JSON — add it
                save_attribute_definition(key, json_attr, sort_order=idx)
                continue
            db_attr = db_attrs[key]
            # Always sync category, name, and id from JSON (structural data)
            db_attr.category = json_attr.category
            db_attr.name = json_attr.name
            db_attr.id = json_attr.id
            # Sync suggested_values if JSON has values but DB is empty
            if json_attr.suggested_values and not db_attr.suggested_values:
                db_attr.suggested_values = json_attr.suggested_values
            # Sync description if JSON has one but DB is empty
            if json_attr.description and not db_attr.description:
                db_attr.description = json_attr.description
            # Always update sort_order to match JSON position
            save_attribute_definition(key, db_attr, sort_order=idx)

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
        return list(self.products.values())

    def get_active_products(self) -> list[Product]:
        return [p for p in self.products.values() if not p.exported]

    def get_archived_products(self) -> list[Product]:
        return [p for p in self.products.values() if p.exported]

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
            self.templates["GPSR"] = gpsr_attrs
            db_save_template("GPSR", gpsr_attrs)

    def get_templates(self) -> dict[str, dict[str, str | int | bool]]:
        return self.templates

    def get_template(self, name: str) -> dict[str, str | int | bool] | None:
        return self.templates.get(name)

    def set_template(self, name: str, attributes: dict[str, str | int | bool]) -> None:
        self.templates[name] = attributes
        db_save_template(name, attributes)

    def remove_template(self, name: str) -> bool:
        if name in self.templates:
            del self.templates[name]
            db_delete_template(name)
            return True
        return False


state = AppState()
