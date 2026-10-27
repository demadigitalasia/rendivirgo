# Bulk product import

Open Admin → Products → Bulk import. Download the Excel template, fill the Products sheet, select the file, then click Preview file. CSV with the same column names is also supported.

- Maximum 500 rows and 5 MB per spreadsheet.
- SKU is required and must be unique within the file.
- New products need name, price and an existing categorySlug; stoneType defaults to Unknown, origin to Indonesia and weightGram to zero. Fill accurate shipping weight before publication.
- New products always start as Draft. Existing publication status is preserved.
- Add mode rejects existing SKUs; Update mode rejects unknown SKUs; combined mode chooses by exact SKU.
- Blank cells preserve existing values on updates. Blank cells do not clear values.
- Numeric values use a decimal point, with no currency symbols or thousands separators. Prices are USD. Booleans use true/false.
- Categories must already exist; use their slugs from the product CSV export.

Select multiple photos with SKU.jpg or SKU-1.jpg, SKU-2.jpg filenames. Matching is case-sensitive, with exact SKUs taking precedence. Up to 20 images per product, 8 MB per image. JPEG, PNG, WebP, GIF and AVIF are supported. ZIP uploads are not supported in this version.

Preview shows all rows, actions, errors and the number of matched photos. Unmatched or duplicate filenames block import. Photos are uploaded only after Import products is selected. Uploaded photos replace the matched product gallery; products without supplied photos retain their gallery.

The server revalidates rows and SKU existence before committing. Each product uses the existing product create/update transaction and audit logging. This is a per-product operation: a business-rule failure can leave other rows saved. The result lists failed rows. Remove successful rows or switch to Update/combined mode before retrying. If the network disconnects during commit, preview again in combined mode to check existing SKUs before retrying. Uploaded media remain in the media library if product creation fails.
