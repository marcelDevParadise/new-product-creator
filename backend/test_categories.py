"""Tests for category tree moves."""

import unittest

from fastapi import HTTPException

from routers.categories import _move_category_node


class MoveCategoryNodeTests(unittest.TestCase):
    def test_moves_complete_branch_below_category(self):
        tree = {
            "Pflege": {"Leder": {"Reiniger": {}}},
            "Zubehör": {},
        }

        result = _move_category_node(tree, ["Pflege", "Leder"], ["Zubehör"])

        self.assertEqual(
            result,
            {
                "Pflege": {},
                "Zubehör": {"Leder": {"Reiniger": {}}},
            },
        )

    def test_moves_category_back_to_root(self):
        tree = {"Pflege": {"Leder": {}}}

        result = _move_category_node(tree, ["Pflege", "Leder"], [])

        self.assertEqual(result, {"Pflege": {}, "Leder": {}})

    def test_rejects_move_into_own_descendant_without_mutating_tree(self):
        tree = {"Pflege": {"Leder": {"Reiniger": {}}}}
        expected = {"Pflege": {"Leder": {"Reiniger": {}}}}

        with self.assertRaises(HTTPException) as context:
            _move_category_node(tree, ["Pflege"], ["Pflege", "Leder"])

        self.assertEqual(context.exception.status_code, 400)
        self.assertEqual(tree, expected)

    def test_rejects_duplicate_name_in_destination_without_mutating_tree(self):
        tree = {
            "Pflege": {"Leder": {"Reiniger": {}}},
            "Zubehör": {"Leder": {}},
        }
        expected = {
            "Pflege": {"Leder": {"Reiniger": {}}},
            "Zubehör": {"Leder": {}},
        }

        with self.assertRaises(HTTPException) as context:
            _move_category_node(tree, ["Pflege", "Leder"], ["Zubehör"])

        self.assertEqual(context.exception.status_code, 409)
        self.assertEqual(tree, expected)


if __name__ == "__main__":
    unittest.main()
