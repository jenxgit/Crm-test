import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import * as XLSX from "xlsx";
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";
import { api, Customer, InvoiceContact, InvoiceDetail, PaymentEntry } from "../lib/api";
import { COMPANY } from "../lib/company";

const money = (v: number) => `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// The template's dates read D/M/YYYY, distinct from the ISO dates used elsewhere in the app.
const fmt = (d: string | null | undefined) => {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${Number(day)}/${Number(m)}/${y}`;
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

function emptyPaymentForm() {
  return { amount: "", method: "", description: "", receivedDate: "", bankedDate: "" };
}

const cell: React.CSSProperties = { padding: "6px 10px", borderBottom: "1px solid #D9DAE2" };
const th: React.CSSProperties = { ...cell, background: "#2B4C7E", color: "#fff", textAlign: "left", fontWeight: 700 };
const tdRight: React.CSSProperties = { ...cell, textAlign: "right" };

export default function InvoiceReceipt() {
  const { id } = useParams();
  const invoiceId = Number(id);
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [renaming, setRenaming] = useState(false);
  const [numberDraft, setNumberDraft] = useState("");
  const [editingDue, setEditingDue] = useState(false);
  const [dueDraft, setDueDraft] = useState("");

  const [editingContact, setEditingContact] = useState(false);
  const [contactChoice, setContactChoice] = useState("");
  const [otherContactPick, setOtherContactPick] = useState("");

  const [showAddPayment, setShowAddPayment] = useState(false);
  const [editingPayment, setEditingPayment] = useState<PaymentEntry | null>(null);
  const [paymentForm, setPaymentForm] = useState(emptyPaymentForm());

  const [addingItem, setAddingItem] = useState(false);
  const [itemDesc, setItemDesc] = useState("");
  const [itemAmount, setItemAmount] = useState("");

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showExport, setShowExport] = useState(false);

  const load = () => {
    api.invoices.get(invoiceId).then(setInvoice);
  };

  useEffect(load, [invoiceId]);
  useEffect(() => {
    api.customers.list().then(setAllCustomers);
  }, []);

  if (!invoice) return <div className="empty-state">Loading&hellip;</div>;

  const act = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message.replace(/^\d+ [^:]*: /, "").replace(/^\{"error":"(.*)"\}$/, "$1") : String(e));
    }
    load();
  };

  const saveNumber = async () => {
    if (!numberDraft.trim()) {
      setError("Invoice number can't be empty");
      return;
    }
    await act(() => api.invoices.update(invoice.id, { invoiceNumber: numberDraft.trim() }));
    setRenaming(false);
  };

  const saveDue = async () => {
    await act(() => api.invoices.update(invoice.id, { dueDate: dueDraft || null }));
    setEditingDue(false);
  };

  const openContactEditor = () => {
    setContactChoice(invoice.primaryContactId != null ? String(invoice.primaryContactId) : "other");
    setOtherContactPick("");
    setEditingContact(true);
  };
  const saveContact = async () => {
    let customerId: number | null = null;
    if (contactChoice === "other") {
      const label = otherContactPick.trim().toLowerCase();
      const match = allCustomers.find((c) => `${c.lastName}, ${c.firstName}`.toLowerCase() === label);
      if (!match) {
        setError("Pick a customer from the list");
        return;
      }
      customerId = match.id;
    } else {
      customerId = Number(contactChoice);
    }
    await act(() => api.invoices.update(invoice.id, { primaryContactId: customerId }));
    setEditingContact(false);
  };

  const removePassenger = (bookingId: number) => act(() => api.bookings.setInvoice(bookingId, null));

  const openAddPayment = () => {
    setEditingPayment(null);
    setPaymentForm(emptyPaymentForm());
    setShowAddPayment(true);
  };
  const openEditPayment = (p: PaymentEntry) => {
    setEditingPayment(p);
    setPaymentForm({
      amount: String(p.amount),
      method: p.method ?? "",
      description: p.description ?? "",
      receivedDate: p.receivedDate ?? "",
      bankedDate: p.bankedDate ?? "",
    });
    setShowAddPayment(true);
  };
  const submitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (paymentForm.amount.trim() === "" || Number.isNaN(Number(paymentForm.amount))) {
      setError("Enter a valid amount");
      return;
    }
    const data = {
      invoiceId: invoice.id,
      amount: Number(paymentForm.amount),
      method: paymentForm.method || null,
      description: paymentForm.description || null,
      receivedDate: paymentForm.receivedDate || null,
      bankedDate: paymentForm.bankedDate || null,
    };
    await act(() => (editingPayment ? api.payments.update(editingPayment.id, data) : api.payments.create(data)));
    setShowAddPayment(false);
  };
  const removePayment = (p: PaymentEntry) => act(() => api.payments.remove(p.id));

  const submitItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemDesc.trim() || itemAmount.trim() === "" || Number.isNaN(Number(itemAmount))) {
      setError("Enter a description and amount");
      return;
    }
    await act(() => api.invoices.addItem(invoice.id, itemDesc.trim(), Number(itemAmount)));
    setAddingItem(false);
    setItemDesc("");
    setItemAmount("");
  };
  const removeItem = (itemId: number) => act(() => api.invoices.removeItem(itemId));

  const deleteInvoice = async () => {
    setConfirmDelete(false);
    await act(async () => {
      await api.invoices.remove(invoice.id);
      navigate("/invoices");
    });
  };

  // Every passenger pays the base tour price; those in a Single room ADDITIONALLY owe the
  // supplement, shown as its own line (matching the paper receipts: e.g. 27 pax x tour price,
  // plus 7 of those 27 also x single supplement). A booking with no known cost (e.g. the tour
  // has no price set) is listed on its own row instead of folded into the aggregate.
  const singlePrice = invoice.price != null && invoice.singleSupp != null ? invoice.price + invoice.singleSupp : null;
  const knownCostPax = invoice.bookings.filter((b) => b.cost === invoice.price || (singlePrice != null && b.cost === singlePrice));
  const singlePax = singlePrice != null ? invoice.bookings.filter((b) => b.cost === singlePrice) : [];
  const otherPax = invoice.bookings.filter((b) => !knownCostPax.includes(b));
  const canAggregate = invoice.price != null;

  const tourLineTotal = knownCostPax.length * (invoice.price ?? 0);
  const singleLineTotal = singlePax.length * (invoice.singleSupp ?? 0);
  const itemsTotal = invoice.lineItems.reduce((sum, it) => sum + it.amount, 0);

  const onInvoice = new Set(invoice.bookings.map((b) => b.customerId));
  const otherCustomers = allCustomers
    .filter((c) => !onInvoice.has(c.id))
    .sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));
  const contactLabel = (c: Customer) => `${c.lastName}, ${c.firstName}`;

  const contactName = (c: InvoiceContact) => [c.title, c.firstName, c.lastName].filter(Boolean).join(" ");

  // A real .xlsx (SheetJS) — a plain data table (numbers, not the letterhead), for further
  // sorting/totalling rather than a copy of the printed page.
  const exportExcel = () => {
    const rows: (string | number)[][] = [];
    rows.push(["Invoice Number", invoice.invoiceNumber]);
    rows.push(["Tour", `${invoice.tourCode ?? ""} ${invoice.tourName ?? ""}`.trim()]);
    rows.push(["Departure", fmt(invoice.departureDate)]);
    rows.push(["To", invoice.primaryContact ? contactName(invoice.primaryContact) : ""]);
    rows.push([]);

    rows.push(["Passengers", "Cost"]);
    invoice.bookings.forEach((b) => rows.push([`${b.firstName} ${b.lastName}`, b.cost ?? ""]));
    rows.push([]);

    rows.push(["Charge", "Price p/p", "PAX", "Total"]);
    if (canAggregate) {
      rows.push([invoice.tourName ?? "", invoice.price ?? "", knownCostPax.length, tourLineTotal]);
      if (singlePax.length > 0) rows.push(["Single Supplement", invoice.singleSupp ?? "", singlePax.length, singleLineTotal]);
      otherPax.forEach((b) => rows.push([`${b.firstName} ${b.lastName}`, "", 1, b.cost ?? ""]));
    } else {
      invoice.bookings.forEach((b) => rows.push([`${b.firstName} ${b.lastName}`, "", 1, b.cost ?? ""]));
    }
    invoice.lineItems.forEach((it) => rows.push([it.description, "", "", it.amount]));
    rows.push(["TOTAL", "", "", tourLineTotal + singleLineTotal + itemsTotal]);
    rows.push([]);

    rows.push(["Received", "Method", "Description", "Amount"]);
    invoice.payments.forEach((p) => rows.push([fmt(p.receivedDate), p.method ?? "", p.description ?? "", p.amount]));
    rows.push(["Balance Due", "", "", invoice.balance]);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 28 }, { wch: 16 }, { wch: 10 }, { wch: 14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Invoice");
    XLSX.writeFile(wb, `Invoice ${invoice.invoiceNumber}.xlsx`);
    setShowExport(false);
  };

  // A real .docx (the `docx` library) laid out with Word tables — the CSS/flex layout used
  // for the on-screen/print view doesn't translate to Word, so this is built fresh rather
  // than copying that markup.
  const exportWord = async () => {
    const accent = "2B4C7E";
    type Align = (typeof AlignmentType)[keyof typeof AlignmentType];
    const pct = (size: number) => ({ size, type: WidthType.PERCENTAGE }) as const;

    const headerCell = (text: string, width?: number) =>
      new TableCell({
        width: width != null ? pct(width) : undefined,
        shading: { type: ShadingType.CLEAR, fill: accent, color: "auto" },
        verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({ children: [new TextRun({ text, bold: true, color: "FFFFFF", size: 18 })] })],
      });
    const dataCell = (text: string, opts: { bold?: boolean; align?: Align; columnSpan?: number; width?: number } = {}) =>
      new TableCell({
        width: opts.width != null ? pct(opts.width) : undefined,
        columnSpan: opts.columnSpan,
        verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({ alignment: opts.align, children: [new TextRun({ text, bold: opts.bold, size: 18 })] })],
      });
    const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
    const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder, insideHorizontal: noBorder, insideVertical: noBorder };
    const spacer = () => new Paragraph({ text: "" });
    const rightLine = (text: string, bold = false) =>
      new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text, bold, size: 18 })] });

    // Company address (left) and invoice details (right), side by side like the printed
    // receipt — Word has no flex layout, so an invisible-bordered 2-column table stands in.
    const letterheadDetails = new Table({
      width: pct(100),
      borders: noBorders,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: pct(55),
              children: [
                new Paragraph(COMPANY.name),
                ...COMPANY.addressLines.map((l) => new Paragraph(l)),
                new Paragraph(`Ph: ${COMPANY.phone}`),
              ],
            }),
            new TableCell({
              width: pct(45),
              children: [
                rightLine(`Invoice Date: ${fmt(invoice.createdAt.slice(0, 10))}`),
                rightLine(`Invoice Number: ${invoice.invoiceNumber}`),
                rightLine(`Tour Code: ${invoice.tourCode ?? "—"}`),
                rightLine(`Amount Due: ${money(invoice.balance)}`, true),
                rightLine(`Due Date: ${fmt(invoice.dueDate) || "—"}`),
              ],
            }),
          ],
        }),
      ],
    });

    const tourRows: TableRow[] = [
      new TableRow({
        children: [
          headerCell("Tour Name", 28),
          headerCell("Date", 24),
          headerCell("Days", 8),
          headerCell("Price p/p", 14),
          headerCell("PAX", 8),
          headerCell("Total", 18),
        ],
      }),
    ];
    const passengerRow = (name: string, cost: number | null) =>
      new TableRow({ children: [dataCell(name), dataCell(""), dataCell(""), dataCell(""), dataCell("1"), dataCell(cost != null ? money(cost) : "—", { align: AlignmentType.RIGHT })] });
    if (canAggregate) {
      tourRows.push(
        new TableRow({
          children: [
            dataCell(invoice.tourName ?? ""),
            dataCell(`${fmt(invoice.departureDate)} to ${fmt(invoice.returnDate)}`),
            dataCell(String(invoice.numDays ?? "")),
            dataCell(money(invoice.price ?? 0)),
            dataCell(String(knownCostPax.length)),
            dataCell(money(tourLineTotal), { align: AlignmentType.RIGHT }),
          ],
        }),
      );
      if (singlePax.length > 0) {
        tourRows.push(
          new TableRow({
            children: [
              dataCell("Single Supplement"),
              dataCell(""),
              dataCell(""),
              dataCell(money(invoice.singleSupp ?? 0)),
              dataCell(String(singlePax.length)),
              dataCell(money(singleLineTotal), { align: AlignmentType.RIGHT }),
            ],
          }),
        );
      }
      otherPax.forEach((b) => tourRows.push(passengerRow(`${b.firstName} ${b.lastName}`, b.cost)));
    } else {
      invoice.bookings.forEach((b) => tourRows.push(passengerRow(`${b.firstName} ${b.lastName}`, b.cost)));
    }
    invoice.lineItems.forEach((it) =>
      tourRows.push(
        new TableRow({
          children: [dataCell(it.description, { bold: true, columnSpan: 5 }), dataCell(money(it.amount), { align: AlignmentType.RIGHT, bold: true })],
        }),
      ),
    );
    tourRows.push(
      new TableRow({
        children: [
          dataCell("TOTAL", { bold: true, columnSpan: 5 }),
          dataCell(money(tourLineTotal + singleLineTotal + itemsTotal), { align: AlignmentType.RIGHT, bold: true }),
        ],
      }),
    );

    const passengerRows = [
      new TableRow({ children: [headerCell("Passenger", 70), headerCell("Cost", 30)] }),
      ...invoice.bookings.map(
        (b) =>
          new TableRow({
            children: [dataCell(`${b.firstName} ${b.lastName}`, { width: 70 }), dataCell(b.cost != null ? money(b.cost) : "—", { align: AlignmentType.RIGHT, width: 30 })],
          }),
      ),
    ];

    const paymentRows = [
      new TableRow({
        children: [headerCell("Received", 20), headerCell("Method", 15), headerCell("Description", 40), headerCell("Amount", 25)],
      }),
      ...invoice.payments.map(
        (p) =>
          new TableRow({
            children: [
              dataCell(fmt(p.receivedDate), { width: 20 }),
              dataCell(p.method ?? "", { width: 15 }),
              dataCell(p.description ?? "", { width: 40 }),
              dataCell(money(p.amount), { align: AlignmentType.RIGHT, width: 25 }),
            ],
          }),
      ),
      new TableRow({ children: [dataCell("Balance Due", { bold: true, columnSpan: 3 }), dataCell(money(invoice.balance), { align: AlignmentType.RIGHT, bold: true })] }),
    ];

    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({ children: [new TextRun({ text: COMPANY.name.replace(" Pty Ltd", ""), bold: true, size: 36, color: accent })] }),
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [new TextRun({ text: "PAYMENT RECEIPT", bold: true, italics: true, size: 28, color: accent })],
            }),
            spacer(),
            letterheadDetails,
            spacer(),
            new Paragraph({ children: [new TextRun({ text: "To:", bold: true })] }),
            ...(invoice.primaryContact
              ? [
                  new Paragraph(contactName(invoice.primaryContact)),
                  ...(invoice.primaryContact.streetAddress ? [new Paragraph(invoice.primaryContact.streetAddress)] : []),
                  ...([invoice.primaryContact.suburb, invoice.primaryContact.state, invoice.primaryContact.postcode].filter(Boolean).length
                    ? [new Paragraph([invoice.primaryContact.suburb, invoice.primaryContact.state, invoice.primaryContact.postcode].filter(Boolean).join(" "))]
                    : []),
                ]
              : [new Paragraph("No primary contact set.")]),
            spacer(),
            new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: tourRows }),
            spacer(),
            new Paragraph({ heading: HeadingLevel.HEADING_3, text: "Passengers" }),
            new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: passengerRows }),
            spacer(),
            new Paragraph({ heading: HeadingLevel.HEADING_3, text: "Payments" }),
            new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: paymentRows }),
            spacer(),
            new Paragraph({ children: [new TextRun({ text: "Payments are inclusive of GST", italics: true })] }),
            spacer(),
            new Paragraph({ heading: HeadingLevel.HEADING_3, text: "Payment Methods" }),
            new Paragraph(
              `CASH DEPOSIT: Visit a ${COMPANY.bank.bankName} Branch and deposit cash directly into our account. Please ask the bank teller to use your phone number as a reference.`,
            ),
            new Paragraph(
              `DIRECT DEPOSIT: Please mail/email a copy of the receipt along with your Full Name and Tour. Account Name: ${COMPANY.bank.accountName} · BSB: ${COMPANY.bank.bsb} · Account Number: ${COMPANY.bank.accountNumber} · Bank: ${COMPANY.bank.bankName}`,
            ),
            new Paragraph(
              `CHEQUE: Cheques should be made out to: ${COMPANY.bank.accountName} (please allow up to 10 working days to receive a receipt)`,
            ),
            spacer(),
            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "THANK YOU", bold: true })] }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              text: `${COMPANY.website} | ABN ${COMPANY.abn} | ${COMPANY.email}`,
            }),
          ],
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    downloadBlob(blob, `Invoice ${invoice.invoiceNumber}.docx`);
    setShowExport(false);
  };

  return (
    <div>
      <Link to="/invoices" className="back-link no-print">
        ← Invoices
      </Link>

      <div className="no-print" style={{ display: "flex", justifyContent: "flex-end", gap: 8, margin: "8px 0 16px", position: "relative" }}>
        <button className="btn btn-secondary" onClick={() => setConfirmDelete(true)}>
          Delete invoice
        </button>
        <button className="btn btn-secondary" onClick={() => window.print()}>
          Print
        </button>
        <div style={{ position: "relative" }}>
          <button className="btn btn-secondary" onClick={() => setShowExport((s) => !s)}>
            Export ▾
          </button>
          {showExport && (
            <div
              style={{
                position: "absolute",
                right: 0,
                top: "calc(100% + 4px)",
                background: "#fff",
                border: "1px solid #E1E1DC",
                borderRadius: 8,
                boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
                zIndex: 10,
                minWidth: 140,
              }}
            >
              <button
                onClick={exportExcel}
                style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 12px", border: "none", background: "none", cursor: "pointer", font: "inherit", fontSize: 13 }}
              >
                Export to Excel
              </button>
              <button
                onClick={exportWord}
                style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 12px", border: "none", background: "none", cursor: "pointer", font: "inherit", fontSize: 13, borderTop: "1px solid #F0F0EC" }}
              >
                Export to Word
              </button>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="no-print" style={{ background: "#FDECEA", color: "#B42318", padding: "8px 12px", borderRadius: 8, marginBottom: 12 }}>
          {error}
        </div>
      )}

      <div className="card" style={{ padding: 32, maxWidth: 860 }}>
        {/* Letterhead */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "4px solid #2B4C7E", paddingBottom: 12 }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#2B4C7E" }}>{COMPANY.name.replace(" Pty Ltd", "")}</div>
          <div style={{ fontSize: 22, fontWeight: 800, fontStyle: "italic", color: "#2B4C7E" }}>PAYMENT RECEIPT</div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginTop: 16, gap: 24, flexWrap: "wrap" }}>
          <div style={{ fontSize: 13.5, lineHeight: 1.6 }}>
            <div>{COMPANY.name}</div>
            {COMPANY.addressLines.map((l) => (
              <div key={l}>{l}</div>
            ))}
            <div>Ph: {COMPANY.phone}</div>
          </div>

          <table style={{ width: "auto", fontSize: 13.5 }}>
            <tbody>
              <tr>
                <td style={{ padding: "3px 10px 3px 0" }}>Invoice Date:</td>
                <td style={{ textAlign: "right", padding: "3px 0" }}>{fmt(invoice.createdAt.slice(0, 10))}</td>
              </tr>
              <tr>
                <td style={{ padding: "3px 10px 3px 0" }}>Invoice Number:</td>
                <td style={{ textAlign: "right", padding: "3px 0" }}>
                  {renaming ? (
                    <span className="no-print">
                      <input
                        autoFocus
                        value={numberDraft}
                        onChange={(e) => setNumberDraft(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && saveNumber()}
                        style={{ width: 110, fontSize: 13 }}
                      />{" "}
                      <button className="btn btn-primary" style={{ padding: "1px 6px", fontSize: 11 }} onClick={saveNumber}>
                        ✓
                      </button>
                    </span>
                  ) : (
                    <>
                      {invoice.invoiceNumber}{" "}
                      <button
                        className="btn btn-secondary no-print"
                        style={{ padding: "0 6px", fontSize: 11 }}
                        onClick={() => {
                          setNumberDraft(invoice.invoiceNumber);
                          setRenaming(true);
                        }}
                      >
                        edit
                      </button>
                    </>
                  )}
                </td>
              </tr>
              <tr>
                <td style={{ padding: "3px 10px 3px 0" }}>Tour Code:</td>
                <td style={{ textAlign: "right", padding: "3px 0" }}>
                  {invoice.tourId ? <Link to={`/tours/${invoice.tourId}`}>{invoice.tourCode}</Link> : "—"}
                </td>
              </tr>
              <tr style={{ background: "#FEF3C7" }}>
                <td style={{ padding: "4px 10px 4px 0", fontWeight: 700 }}>Amount Due:</td>
                <td style={{ textAlign: "right", fontWeight: 700, padding: "4px 0" }}>{money(invoice.balance)}</td>
              </tr>
              <tr>
                <td style={{ padding: "3px 10px 3px 0" }}>Due Date:</td>
                <td style={{ textAlign: "right", padding: "3px 0" }}>
                  {editingDue ? (
                    <span className="no-print">
                      <input
                        autoFocus
                        type="date"
                        value={dueDraft}
                        onChange={(e) => setDueDraft(e.target.value)}
                        style={{ fontSize: 12 }}
                      />{" "}
                      <button className="btn btn-primary" style={{ padding: "1px 6px", fontSize: 11 }} onClick={saveDue}>
                        ✓
                      </button>
                    </span>
                  ) : (
                    <>
                      {fmt(invoice.dueDate) || "—"}{" "}
                      <button
                        className="btn btn-secondary no-print"
                        style={{ padding: "0 6px", fontSize: 11 }}
                        onClick={() => {
                          setDueDraft(invoice.dueDate ?? "");
                          setEditingDue(true);
                        }}
                      >
                        edit
                      </button>
                    </>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* To: */}
        <div style={{ marginTop: 24 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>To:</div>
          {invoice.primaryContact ? (
            <div style={{ fontSize: 13.5, lineHeight: 1.6 }}>
              <div>
                <Link to={`/customers/${invoice.primaryContact.id}`}>{contactName(invoice.primaryContact)}</Link>
              </div>
              {invoice.primaryContact.streetAddress && <div>{invoice.primaryContact.streetAddress}</div>}
              {(invoice.primaryContact.suburb || invoice.primaryContact.state || invoice.primaryContact.postcode) && (
                <div>
                  {[invoice.primaryContact.suburb, invoice.primaryContact.state, invoice.primaryContact.postcode]
                    .filter(Boolean)
                    .join(" ")}
                </div>
              )}
            </div>
          ) : (
            <div className="muted" style={{ fontSize: 13.5 }}>
              No primary contact set.
            </div>
          )}
          {!editingContact ? (
            <button className="btn btn-secondary no-print" style={{ padding: "1px 8px", fontSize: 11, marginTop: 6 }} onClick={openContactEditor}>
              Change
            </button>
          ) : (
            <div className="no-print" style={{ marginTop: 8, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <select value={contactChoice} onChange={(e) => setContactChoice(e.target.value)} style={{ fontSize: 12 }}>
                {invoice.bookings.map((b) => (
                  <option key={b.customerId} value={b.customerId}>
                    {b.firstName} {b.lastName}
                  </option>
                ))}
                <option value="other">Other…</option>
              </select>
              {contactChoice === "other" && (
                <>
                  <input
                    list="all-customers"
                    placeholder="Search customers…"
                    value={otherContactPick}
                    onChange={(e) => setOtherContactPick(e.target.value)}
                    style={{ width: 220, fontSize: 12 }}
                  />
                  <datalist id="all-customers">
                    {otherCustomers.map((c) => (
                      <option key={c.id} value={contactLabel(c)} />
                    ))}
                  </datalist>
                </>
              )}
              <button className="btn btn-primary" style={{ padding: "2px 8px", fontSize: 11 }} onClick={saveContact}>
                Save
              </button>
              <button className="btn btn-secondary" style={{ padding: "2px 8px", fontSize: 11 }} onClick={() => setEditingContact(false)}>
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* Tour / price / payments table */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 24, fontSize: 13.5 }}>
          <thead>
            <tr>
              <th style={th}>Tour Name</th>
              <th style={th}>Date</th>
              <th style={th}>Days</th>
              <th style={th}>Tour Price p/p</th>
              <th style={th}>PAX</th>
              <th style={{ ...th, textAlign: "right" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {canAggregate ? (
              <>
                <tr>
                  <td style={cell}>{invoice.tourName}</td>
                  <td style={cell}>
                    {fmt(invoice.departureDate)} to {fmt(invoice.returnDate)}
                  </td>
                  <td style={cell}>{invoice.numDays}</td>
                  <td style={cell}>{money(invoice.price ?? 0)}</td>
                  <td style={cell}>{knownCostPax.length}</td>
                  <td style={tdRight}>{money(tourLineTotal)}</td>
                </tr>
                {singlePax.length > 0 && (
                  <tr>
                    <td style={cell}>Single Supplement</td>
                    <td style={cell}></td>
                    <td style={cell}></td>
                    <td style={cell}>{money(invoice.singleSupp ?? 0)}</td>
                    <td style={cell}>{singlePax.length}</td>
                    <td style={tdRight}>{money(singleLineTotal)}</td>
                  </tr>
                )}
                {otherPax.length > 0 &&
                  otherPax.map((b) => (
                    <tr key={b.bookingId}>
                      <td style={cell}>
                        {b.firstName} {b.lastName}
                      </td>
                      <td style={cell} colSpan={3}></td>
                      <td style={cell}>1</td>
                      <td style={tdRight}>{b.cost != null ? money(b.cost) : "—"}</td>
                    </tr>
                  ))}
              </>
            ) : (
              invoice.bookings.map((b) => (
                <tr key={b.bookingId}>
                  <td style={cell}>
                    {b.firstName} {b.lastName}
                  </td>
                  <td style={cell} colSpan={3}></td>
                  <td style={cell}>1</td>
                  <td style={tdRight}>{b.cost != null ? money(b.cost) : "—"}</td>
                </tr>
              ))
            )}

            {invoice.lineItems.map((it) => (
              <tr key={it.id}>
                <td style={{ ...cell, color: it.amount < 0 ? "#1C1D21" : "#B42318" }} colSpan={4}>
                  {it.description}
                </td>
                <td style={cell}>
                  <button
                    className="btn btn-secondary no-print"
                    style={{ padding: "0 6px", fontSize: 11 }}
                    onClick={() => removeItem(it.id)}
                  >
                    remove
                  </button>
                </td>
                <td style={{ ...tdRight, color: it.amount < 0 ? "#1C1D21" : "#B42318" }}>{money(it.amount)}</td>
              </tr>
            ))}
            <tr className="no-print">
              <td style={cell} colSpan={6}>
                {addingItem ? (
                  <form onSubmit={submitItem} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input
                      autoFocus
                      placeholder="Description, e.g. Cancellation Fee"
                      value={itemDesc}
                      onChange={(e) => setItemDesc(e.target.value)}
                      style={{ flex: 1, fontSize: 12 }}
                    />
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Amount"
                      value={itemAmount}
                      onChange={(e) => setItemAmount(e.target.value)}
                      style={{ width: 100, fontSize: 12 }}
                    />
                    <button type="submit" className="btn btn-primary" style={{ padding: "2px 8px", fontSize: 11 }}>
                      Add
                    </button>
                    <button type="button" className="btn btn-secondary" style={{ padding: "2px 8px", fontSize: 11 }} onClick={() => setAddingItem(false)}>
                      Cancel
                    </button>
                  </form>
                ) : (
                  <button className="btn btn-secondary" style={{ padding: "2px 8px", fontSize: 11 }} onClick={() => setAddingItem(true)}>
                    + Add line (e.g. fee or credit)
                  </button>
                )}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Passengers fill the space beside the TOTAL through Balance Due summary box, which
            stays a narrower 33% column right-aligned under the tour table. */}
        <div style={{ display: "flex", gap: 24, alignItems: "flex-start", marginTop: 14 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
              <thead>
                <tr>
                  <th style={th} colSpan={2}>
                    Passengers
                  </th>
                </tr>
              </thead>
              <tbody>
                {invoice.bookings.length === 0 ? (
                  <tr>
                    <td style={cell} colSpan={2}>
                      No passengers on this invoice.
                    </td>
                  </tr>
                ) : (
                  invoice.bookings.map((b) => (
                    <tr key={b.bookingId}>
                      <td style={cell}>
                        <Link to={`/customers/${b.customerId}`}>
                          {b.firstName} {b.lastName}
                        </Link>
                        <span className="no-print">
                          {" "}
                          <button
                            className="btn btn-secondary"
                            style={{ padding: "0 6px", fontSize: 11 }}
                            onClick={() => removePassenger(b.bookingId)}
                          >
                            remove
                          </button>
                        </span>
                      </td>
                      <td style={tdRight}>{b.cost != null ? money(b.cost) : "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <table style={{ width: "33%", minWidth: 260, borderCollapse: "collapse", fontSize: 13.5 }}>
            <tbody>
              <tr style={{ background: "#EEF1F6" }}>
                <td style={{ ...cell, fontWeight: 700 }}>TOTAL</td>
                <td style={{ ...tdRight, fontWeight: 700 }}>{money(tourLineTotal + singleLineTotal + itemsTotal)}</td>
              </tr>

              <tr>
                <td style={{ ...cell, fontWeight: 700, background: "#EEF1F6" }} colSpan={2}>
                  Payments
                </td>
              </tr>
              {invoice.payments.map((p) => (
                <tr key={p.id}>
                  <td style={cell}>
                    {p.receivedDate ? `Received ${fmt(p.receivedDate)}` : p.description || "—"}
                    {p.method ? ` ${p.method}` : ""}
                    <span className="no-print">
                      {" "}
                      <button className="btn btn-secondary" style={{ padding: "0 6px", fontSize: 11, marginRight: 4 }} onClick={() => openEditPayment(p)}>
                        edit
                      </button>
                      <button className="btn btn-secondary" style={{ padding: "0 6px", fontSize: 11 }} onClick={() => removePayment(p)}>
                        remove
                      </button>
                    </span>
                  </td>
                  <td style={tdRight}>{money(p.amount)}</td>
                </tr>
              ))}
              <tr className="no-print">
                <td style={cell} colSpan={2}>
                  <button className="btn btn-secondary" style={{ padding: "2px 8px", fontSize: 11 }} onClick={openAddPayment}>
                    + Add payment
                  </button>
                </td>
              </tr>
              <tr style={{ background: "#EEF1F6" }}>
                <td style={{ ...cell, fontWeight: 700 }}>Balance Due</td>
                <td style={{ ...tdRight, fontWeight: 700 }}>{money(invoice.balance)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="muted" style={{ fontSize: 12, marginTop: 4, textAlign: "right" }}>
          Payments are inclusive of GST
        </div>

        {/* Payment methods */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 24, fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: "center" }} colSpan={2}>
                Payment Methods
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ ...cell, fontWeight: 700, whiteSpace: "nowrap" }}>CASH DEPOSIT:</td>
              <td style={cell}>
                Visit a {COMPANY.bank.bankName} Branch and deposit cash directly into our account &rarr; Please ask
                the bank teller to use your phone number as a reference.
              </td>
            </tr>
            <tr>
              <td style={{ ...cell, fontWeight: 700, whiteSpace: "nowrap" }}>DIRECT DEPOSIT:</td>
              <td style={cell}>
                Please mail/email a copy of the receipt along with your Full Name and Tour.
                <br />
                Account Name: <b>{COMPANY.bank.accountName}</b> &middot; BSB: {COMPANY.bank.bsb} &middot; Account
                Number: {COMPANY.bank.accountNumber} &middot; Bank: {COMPANY.bank.bankName}
              </td>
            </tr>
            <tr>
              <td style={{ ...cell, fontWeight: 700, whiteSpace: "nowrap" }}>CHEQUE:</td>
              <td style={cell}>
                Cheques should be made out to: <b>{COMPANY.bank.accountName}</b> (please allow up to 10 working days
                to receive a receipt)
              </td>
            </tr>
          </tbody>
        </table>

        <div style={{ textAlign: "center", marginTop: 24, fontSize: 13 }}>
          <div style={{ fontWeight: 700 }}>THANK YOU</div>
          <div>
            {COMPANY.website} &nbsp;|&nbsp; ABN {COMPANY.abn} &nbsp;|&nbsp; {COMPANY.email}
          </div>
        </div>
      </div>

      {showAddPayment && (
        <div className="modal-backdrop" onClick={() => setShowAddPayment(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editingPayment ? "Edit payment" : "Add payment"}</h2>
            <form onSubmit={submitPayment}>
              <div className="form-grid">
                <label>
                  Amount ($)
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  />
                </label>
                <label>
                  Method
                  <input
                    placeholder="e.g. CH, DD, CC"
                    value={paymentForm.method}
                    onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value })}
                  />
                </label>
              </div>
              <div className="form-grid full">
                <label>
                  Description
                  <input
                    value={paymentForm.description}
                    onChange={(e) => setPaymentForm({ ...paymentForm, description: e.target.value })}
                  />
                </label>
              </div>
              <div className="form-grid">
                <label>
                  Received date
                  <input
                    type="date"
                    value={paymentForm.receivedDate}
                    onChange={(e) => setPaymentForm({ ...paymentForm, receivedDate: e.target.value })}
                  />
                </label>
                <label>
                  Banked date
                  <input
                    type="date"
                    value={paymentForm.bankedDate}
                    onChange={(e) => setPaymentForm({ ...paymentForm, bankedDate: e.target.value })}
                  />
                </label>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddPayment(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingPayment ? "Save" : "Add payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="modal-backdrop" onClick={() => setConfirmDelete(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Delete this invoice?</h2>
            <p>
              Its passengers stay booked on the tour but become un-invoiced. This is blocked if any payments are
              still recorded against it &mdash; remove those first.
            </p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setConfirmDelete(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={deleteInvoice}>
                Yes, delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
