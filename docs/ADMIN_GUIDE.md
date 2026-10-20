# Control room guide

Open the control room with the secret link `https://YOUR-SITE/control-room?key=YOUR_ADMIN_GATE_KEY` (once per browser; it is remembered for 12 hours), sign in, and enter the 6-digit code from your authenticator app.

## Menu

Click any item in the left menu and it opens directly. Groups (Catalogue, Sales, Inventory, Marketing, Finance, Settings) fold open and closed. Each person only sees the sections their role allows.

| Section | What it does |
|---|---|
| **Overview** | Key numbers with a *period* drop-down (today … 12 months) and a *customer type* drop-down (all / retail / business / export). Sections fold open/closed: Sales & money, Stock & enquiries, Website traffic. |
| **Website traffic** | Anonymous visitors, pages, sources, devices, countries, and the funnel visit → enquiry → customer → order → paid. |
| **Products** | Name, category, description, specifications, retail and business price, GST, discount (percentage or fixed, with start/end dates), reorder level, export details. The **Images** tab inside a product uploads photos, sets the main photo and reorders them. |
| **Certificates & achievements** | Add, remove, **reorder** (drag or arrows). Certificates, achievements, awards and testimonials. Expired certificates hide themselves. Private PDF originals are staff-only. |
| **Website sections / Navigation menu** | Show, hide, rename and reorder home-page sections and header links. |
| **Orders** | Create orders (prices, GST and coupons calculated by the system). Open an order to move it stage by stage: confirmed → processing → packed → shipped → delivered (or cancelled / refunded), record payments, add courier and tracking, add notes, see the full timeline, print a summary. Customers can follow their order on `/track`. |
| **Customers** | One record per buyer, with or without a website login; type (retail / business / export), GSTIN, notes, order history, lifetime value. |
| **Enquiries** | Website enquiries; move them through stages; **Make customer** converts a lead. |
| **Stock / Purchases & suppliers** | *Purchases* → **Receive stock** adds batches and books what you owe. *Packing an order* deducts stock (earliest expiry first, expired batches never used) and books cost of goods. Opening stock, adjustments, wastage, movement history. |
| **Coupons** | Codes by **customer type** (retail / business / export / everyone), minimum order, maximum discount, usage limits, expiry, first-order-only, product/category scope. Usage tab shows redemptions. |
| **Referrals** | Programme rules (new-customer discount, referrer reward), referral list, mark rewarded / reject. |
| **Finance** | Overview, record transactions (rent, salaries, owner money…), Profit & Loss, Balance sheet, Trial balance, Receivables, Payables with ageing. Everything from orders, payments and purchases is booked automatically. |
| **Team & access** | Invite people, set roles, switch access off. |
| **Security / Audit log** | Two-step verification, sign out, and the permanent record of changes. |
| **AI chatbot / Integrations** | Chat settings and facts; status of every outside service. |

## Roles

* **Owner** everything, including other owners. **Admin** everything except changing owners.
* **Finance** accounts, payments, statements, audit log. **Operations** orders, stock, purchases, customers, enquiries.
* **Content manager** products, photos, certificates, website text, menu, coupons, chatbot. Cannot see customers or money.

## How stock and money connect

1. **Purchase received** → stock up; *Inventory* and *Accounts payable* booked; paying the supplier reduces payable and cash.
2. **Order packed** → stock down (oldest expiry first); *Cost of goods sold* booked.
3. **Order shipped** → invoice booked (*Receivable*, *Sales*, *GST payable*); any advance is applied.
4. **Payment recorded** → cash up; receivable (or advance) down.
5. **Cancel / refund** → stock, invoice and advances are reversed or marked refunded.

Books are in **INR**. Export invoices in USD/AED need the currency integration (placeholder). GST treatment (export zero-rating, TDS, e-invoicing) is a sensible default; have your accountant confirm it before filing.
