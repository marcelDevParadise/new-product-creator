"""Categories router — CRUD for the category hierarchy tree."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from state import state

router = APIRouter(prefix="/api/categories", tags=["categories"])


class NodePayload(BaseModel):
    path: list[str]
    name: str


class RenamePayload(BaseModel):
    path: list[str]
    new_name: str


class MovePayload(BaseModel):
    source_path: list[str]
    destination_path: list[str]


def _get_node(tree: dict, path: list[str], label: str) -> dict:
    node = tree
    for segment in path:
        if segment not in node:
            raise HTTPException(404, f"{label} nicht gefunden: {segment}")
        node = node[segment]
    return node


def _move_category_node(tree: dict, source_path: list[str], destination_path: list[str]) -> dict:
    """Move a complete category branch below another category (or to the root)."""
    if not source_path:
        raise HTTPException(400, "Quellpfad darf nicht leer sein")
    if destination_path[:len(source_path)] == source_path:
        raise HTTPException(400, "Eine Kategorie kann nicht in sich selbst verschoben werden")

    source_parent = _get_node(tree, source_path[:-1], "Quellpfad")
    source_name = source_path[-1]
    if source_name not in source_parent:
        raise HTTPException(404, f"Kategorie '{source_name}' nicht gefunden")

    destination = _get_node(tree, destination_path, "Zielkategorie")
    if source_parent is destination:
        return tree
    if source_name in destination:
        raise HTTPException(
            409,
            f"Kategorie '{source_name}' existiert in der Zielkategorie bereits",
        )

    branch = source_parent.pop(source_name)
    destination[source_name] = branch
    return tree


@router.get("/tree")
def get_tree() -> dict:
    """Return the full category tree."""
    return state.get_category_tree()


@router.put("/tree")
def replace_tree(tree: dict) -> dict:
    """Replace the entire category tree."""
    state.save_category_tree(tree)
    return state.get_category_tree()


@router.get("/children")
def get_children(parent: str = "") -> list[str]:
    """Return child category names for a given parent path (dot-separated)."""
    path = [p for p in parent.split(".") if p] if parent else []
    children = state.get_category_children(path)
    if children is None:
        raise HTTPException(404, f"Kategoriepfad nicht gefunden: {parent}")
    return children


@router.post("/node")
def add_node(payload: NodePayload) -> dict:
    """Add a new category node at the given path."""
    tree = state.get_category_tree()
    node = tree
    for segment in payload.path:
        if segment not in node:
            raise HTTPException(404, f"Elternkategorie nicht gefunden: {segment}")
        node = node[segment]
    if payload.name in node:
        raise HTTPException(409, f"Kategorie '{payload.name}' existiert bereits")
    node[payload.name] = {}
    state.save_category_tree(tree)
    return state.get_category_tree()


@router.put("/node")
def rename_node(payload: RenamePayload) -> dict:
    """Rename a category node. The last element of path is the node to rename."""
    if not payload.path:
        raise HTTPException(400, "Pfad darf nicht leer sein")
    tree = state.get_category_tree()
    node = tree
    for segment in payload.path[:-1]:
        if segment not in node:
            raise HTTPException(404, f"Elternkategorie nicht gefunden: {segment}")
        node = node[segment]
    old_name = payload.path[-1]
    if old_name not in node:
        raise HTTPException(404, f"Kategorie '{old_name}' nicht gefunden")
    if payload.new_name in node:
        raise HTTPException(409, f"Kategorie '{payload.new_name}' existiert bereits")
    # Preserve order and children
    node[payload.new_name] = node.pop(old_name)
    state.save_category_tree(tree)
    return state.get_category_tree()


@router.post("/node/move")
def move_node(payload: MovePayload) -> dict:
    """Move a category and all of its children below a new parent."""
    tree = state.get_category_tree()
    _move_category_node(tree, payload.source_path, payload.destination_path)
    state.save_category_tree(tree)
    return state.get_category_tree()


@router.delete("/node")
def delete_node(payload: NodePayload) -> dict:
    """Delete a category node at the given path. payload.name is the node to delete within path."""
    tree = state.get_category_tree()
    node = tree
    for segment in payload.path:
        if segment not in node:
            raise HTTPException(404, f"Elternkategorie nicht gefunden: {segment}")
        node = node[segment]
    if payload.name not in node:
        raise HTTPException(404, f"Kategorie '{payload.name}' nicht gefunden")
    del node[payload.name]
    state.save_category_tree(tree)
    return state.get_category_tree()
