import unittest

from services.shopify_metafields import MetafieldValueError, serialize_for_jtl


class ShopifyMetafieldValueTests(unittest.TestCase):
    def test_measurement_uses_compact_canonical_json(self):
        self.assertEqual(
            serialize_for_jtl(30, "duration", "seconds"),
            '{"value":30.0,"unit":"seconds"}',
        )

    def test_list_uses_json_array(self):
        self.assertEqual(
            serialize_for_jtl(["Latex", "Polyurethan"], "list.single_line_text_field"),
            '["Latex","Polyurethan"]',
        )

    def test_reference_requires_gid(self):
        with self.assertRaises(MetafieldValueError):
            serialize_for_jtl("Hersteller GmbH", "metaobject_reference")

    def test_json_string_remains_valid_json(self):
        self.assertEqual(serialize_for_jtl("Text", "json"), '"Text"')


if __name__ == "__main__":
    unittest.main()
