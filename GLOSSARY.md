# Commerce

This context covers customer orders, their payment, and the fulfillment lifecycle for RENDI VIRGO.

## Language

**Order**:
A customer's request to purchase a set of products under a recorded price and delivery arrangement.

**Delivery estimate**:
The expected range of business days from dispatch to delivery for a shipping option. It is an estimate and excludes order preparation time.

**Customer**:
A person or business represented by a customer profile used for order, contact, and service records. A customer profile can exist without a login.

**Customer account**:
A customer's verified login identity for private self-service features. It is associated with one customer profile; the account controls access, while the profile holds the customer's commerce and contact history.

**Wholesale access**:
An admin-granted permission associated with a verified customer account and customer profile. It enables access to the private Wholesale catalog and Wholesale checkout without creating a separate login.

**Sales channel**:
A place where a product may be offered for sale: the public Retail website, the private Wholesale dashboard, or POS Workshop. Channel availability controls where a product can be sold; the agreed Wholesale design uses shared inventory across channels.

**Sellable unit**:
The product quantity unit used when an order line is created, such as a piece, pair, gram, strand, or bag. Wholesale's 100-piece threshold uses a product/variant conversion factor to calculate equivalent pieces across order lines.

**Inventory reservation**:
Stock temporarily held against an online order awaiting payment or a POS sale before payment is confirmed. Active reservations reduce the quantity available to every sales channel; a reservation is committed to physical stock on successful payment or released when the order/sale is canceled, fails, or expires.

**Payment settlement**:
Confirmation that the amount due for an order has been received.

**Late payment**:
A payment received after the order's payment window has expired and its inventory reservation has been released.

**Refund record**:
An accounting record of an amount refunded for an order; it does not by itself mean money was sent to the customer.
