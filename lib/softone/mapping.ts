/**
 * Registry of how our data maps onto SoftOne objects (checked against the
 * cached schema of kolleris.oncloud.gr, SoftOne 6.00.623). Client-safe (no DB):
 * it drives the «Δομή δεδομένων» page, the mappers and the checks.
 *
 * SODTYPE codes (SoftOne shared tables): TRDR 13 = πελάτης, 12 = προμηθευτής ·
 * MTRL 51 = είδος, 52 = υπηρεσία.
 */
export type FieldMap = {
  s1: string;                  // SoftOne field
  ours: string;                // our model.field, a constant, or a parameter
  required?: boolean;
  kind: "direct" | "param" | "constant" | "derived" | "gap";
  note?: string;
};

export type EntityMap = {
  key: string;
  ours: string;                // Prisma model
  object: string;              // SoftOne object
  table: string;               // master DB table
  caption: string;
  linkField: string;           // our column that stores the SoftOne id
  description: string;
  fields: FieldMap[];
  lines?: { table: string; caption: string; fields: FieldMap[] };
  prerequisites: string[];     // what must exist in SoftOne first
};

export const SODTYPE = { CUSTOMER: 13, SUPPLIER: 12, ITEM: 51, SERVICE: 52 } as const;

export const ENTITY_MAPS: EntityMap[] = [
  {
    key: "customer", ours: "Customer", object: "CUSTOMER", table: "TRDR", caption: "Πελάτες", linkField: "Customer.softoneTrdr",
    description: "Κάθε πελάτης της εταιρείας διαχείρισης (ιδιώτης ή εταιρεία) → καρτέλα πελάτη στο SoftOne (TRDR, SODTYPE 13).",
    fields: [
      { s1: "CODE", ours: "Customer.code ή prefix+αριθμός", required: true, kind: "derived", note: "codePrefixCustomer + αύξων" },
      { s1: "NAME", ours: "Customer.name", required: true, kind: "direct" },
      { s1: "AFM", ours: "Customer.afm", kind: "direct", note: "χωρίς ΑΦΜ → CHKAFM=0" },
      { s1: "IRSDATA", ours: "Customer.doy", kind: "direct" },
      { s1: "ADDRESS / ZIP / CITY / DISTRICT", ours: "Customer.address / postalCode / city / district", kind: "direct" },
      { s1: "PHONE01 / PHONE02 / FAX / EMAIL / WEBPAGE", ours: "Customer.phone / phone2 / fax / email / webpage", kind: "direct" },
      { s1: "COUNTRY", ours: "SoftoneSettings.countryGr", required: true, kind: "param" },
      { s1: "SOCURRENCY", ours: "SoftoneSettings.currencyEur", required: true, kind: "param" },
      { s1: "PAYMENT", ours: "SoftoneSettings.paymentDefault", kind: "param" },
      { s1: "ISACTIVE", ours: "Customer.isActive", required: true, kind: "direct" },
      { s1: "CMPMODE", ours: "Customer.type (INDIVIDUAL→φυσ. πρόσωπο, COMPANY→νομ. πρόσωπο)", required: true, kind: "derived" },
      { s1: "VATSTS / KEPYOSTS / KEPYOMD / GSISMD / OPITMODE / …", ours: "προεπιλογές SoftOne (δεν στέλνονται)", required: true, kind: "constant", note: "Το ERP συμπληρώνει defaults σε insert" },
      { s1: "REMARKS", ours: "Customer.remarks", kind: "direct" },
    ],
    prerequisites: ["COUNTRY (Ελλάδα)", "SOCURRENCY (EUR)", "PAYMENT (προεπιλογή)"],
  },
  {
    key: "supplier", ours: "Supplier", object: "SUPPLIER", table: "TRDR", caption: "Προμηθευτές / Συνεργάτες", linkField: "Supplier.softoneTrdr",
    description: "Μόνο το μητρώο της εταιρείας (customerId = null, όχι isPlatform). Οι ιδιωτικές λίστες των διαχειριστών ΔΕΝ συγχρονίζονται.",
    fields: [
      { s1: "CODE", ours: "Supplier.code ή prefix+αριθμός", required: true, kind: "derived" },
      { s1: "NAME", ours: "Supplier.name", required: true, kind: "direct" },
      { s1: "AFM / IRSDATA", ours: "Supplier.afm / doy", kind: "direct" },
      { s1: "ADDRESS / ZIP / CITY / PHONE01 / EMAIL", ours: "Supplier.address / postalCode / city / phone / email", kind: "direct" },
      { s1: "COUNTRY / SOCURRENCY", ours: "SoftoneSettings.countryGr / currencyEur", required: true, kind: "param" },
      { s1: "PAYMENT", ours: "Supplier.paymentTermsDays → PAYMENT id", kind: "gap", note: "Χρειάζεται πίνακας αντιστοίχισης ημερών πίστωσης → PAYMENT" },
      { s1: "ISACTIVE", ours: "Supplier.isActive", required: true, kind: "direct" },
      { s1: "INPAYVAT (άρθρο 39β)", ours: "—", required: true, kind: "constant", note: "0 (προεπιλογή)" },
      { s1: "IBAN (BANKACC / TRDBANK)", ours: "Supplier.iban / bank", kind: "gap", note: "Ο IBAN ζει σε child table τραπεζικών λογαριασμών — 2ο βήμα" },
      { s1: "REMARKS", ours: "Supplier.remarks + ειδικότητες", kind: "derived" },
    ],
    prerequisites: ["COUNTRY", "SOCURRENCY", "PAYMENT"],
  },
  {
    key: "building", ours: "Building", object: "PRJC", table: "PRJC", caption: "Έργα (κτήρια)", linkField: "Building.softonePrjc",
    description: "Κάθε κτήριο → Έργο SoftOne με πελάτη τον ιδιοκτήτη-πελάτη του ακινήτου. Συμβάσεις και παραστατικά αναφέρονται στο PRJC.",
    fields: [
      { s1: "CODE", ours: "codePrefixProject + αύξων", required: true, kind: "derived" },
      { s1: "NAME", ours: "Building.name (+ διεύθυνση)", required: true, kind: "direct" },
      { s1: "TRDR", ours: "Property.customer.softoneTrdr", kind: "derived", note: "ο πελάτης πρέπει να έχει συγχρονιστεί πρώτα" },
      { s1: "PRJTYPE", ours: "SoftoneSettings.prjType", required: true, kind: "param" },
      { s1: "ISACTIVE / BLOCKED", ours: "true / false", required: true, kind: "constant" },
      { s1: "FROMDATE", ours: "Property.managedSince ή createdAt", kind: "derived" },
      { s1: "REMARKS", ours: "διεύθυνση, όροφοι, ανελκυστήρας", kind: "derived" },
    ],
    prerequisites: ["CUSTOMER συγχρονισμένος", "PRJTYPE"],
  },
  {
    key: "service", ours: "Service · ServiceCatalogItem · SupplierService", object: "SERVICE", table: "MTRL", caption: "Υπηρεσίες", linkField: "*.softoneMtrl",
    description: "Οι υπηρεσίες της εταιρείας (πακέτα), ο κατάλογος υπηρεσιών συνεργατών και οι υπηρεσίες κάθε συνεργάτη → Υπηρεσίες SoftOne (MTRL, SODTYPE 52). Τιμή συνεργάτη = PRICEW (χονδρικής), τιμή πελάτη = PRICER.",
    fields: [
      { s1: "CODE", ours: "Service.code / codePrefixService + αύξων", required: true, kind: "derived" },
      { s1: "NAME", ours: "name", required: true, kind: "direct" },
      { s1: "VAT", ours: "vatPct → SoftoneSettings.vatMap", required: true, kind: "param" },
      { s1: "MTRUNIT1", ours: "unit → SoftoneSettings.unitMap", required: true, kind: "param" },
      { s1: "MTRTYPE", ours: "1 (υπηρεσία)", required: true, kind: "constant" },
      { s1: "PRICEW / PRICER", ours: "supplierPrice / customerPrice", kind: "direct" },
      { s1: "MTRCATEGORY (SRVCATEGORY)", ours: "MaintenanceCategory", kind: "gap", note: "Προαιρετικό: κατηγορίες υπηρεσιών στο ERP" },
      { s1: "ISACTIVE", ours: "active", required: true, kind: "direct" },
    ],
    prerequisites: ["VAT ids", "MTRUNIT ids"],
  },
  {
    key: "product", ours: "SupplierProduct", object: "ITEM", table: "MTRL", caption: "Είδη (προϊόντα συνεργατών)", linkField: "SupplierProduct.softoneMtrl",
    description: "Προϊόντα που τιμολογούν οι συνεργάτες (λαμπτήρες, ανταλλακτικά) → Είδη SoftOne (MTRL, SODTYPE 51).",
    fields: [
      { s1: "CODE / NAME", ours: "sku ή prefix+αύξων / name", required: true, kind: "derived" },
      { s1: "VAT / MTRUNIT1", ours: "vatPct / unit → params", required: true, kind: "param" },
      { s1: "MTRUNIT3 / MTRUNIT4 / MU31 / MU41", ours: "= MTRUNIT1 / 1", required: true, kind: "constant" },
      { s1: "PRICEW / PRICER", ours: "price / price×(1+markup)", kind: "derived" },
      { s1: "MTRTYPE / REMAINMODE / … (30 flags)", ours: "προεπιλογές ERP", required: true, kind: "constant" },
    ],
    prerequisites: ["VAT ids", "MTRUNIT ids"],
  },
  {
    key: "work-order", ours: "WorkOrder", object: "CNTR", table: "CNTR", caption: "Συμβάσεις έργου (back-to-back)", linkField: "WorkOrder.softoneCntrA / softoneCntrB",
    description: "Κάθε σύμβαση έργου γίνεται ΔΥΟ Ειδικές συμβάσεις SoftOne με διάρκεια: Α (TSODTYPE 13, TRDR = πελάτης, τιμή πελάτη) και Β (TSODTYPE 12, TRDR = συνεργάτης, τιμή συνεργάτη, CNTRS → Α). Και οι δύο έχουν γραμμή υπηρεσίας με διάρκεια (εγγύηση) και προαιρετικά γραμμές ειδών.",
    fields: [
      { s1: "CODE", ours: "WorkOrder.number + '-A' / '-B'", required: true, kind: "derived" },
      { s1: "NAME", ours: "WorkOrder.title", required: true, kind: "direct" },
      { s1: "TRNDATE", ours: "createdAt", required: true, kind: "direct" },
      { s1: "FROMDATE", ours: "customerAcceptedAt / supplierAcceptedAt (ή scheduledAt)", required: true, kind: "derived" },
      { s1: "TODATE", ours: "completedAt + warrantyMonths", kind: "derived", note: "διάρκεια σύμβασης = μέχρι τη λήξη εγγύησης" },
      { s1: "CNTRTYPE", ours: "SoftoneSettings.cntrTypeCustomer / cntrTypeSupplier", required: true, kind: "param" },
      { s1: "CNTRTYPE1", ours: "SoftoneSettings.cntrType1Default", required: true, kind: "param" },
      { s1: "TSODTYPE / TRDR", ours: "13 + Customer.softoneTrdr · 12 + Supplier.softoneTrdr", required: true, kind: "derived" },
      { s1: "CNTRS (σχετική)", ours: "Β → id της Α", kind: "derived", note: "η back-to-back σύνδεση" },
      { s1: "PRJC", ours: "Building.softonePrjc", kind: "derived" },
      { s1: "BRANCH", ours: "SoftoneSettings.branch", required: true, kind: "param" },
      { s1: "CNTRVALUE / SOVALUE", ours: "customerPrice · supplierPrice (καθαρά)", kind: "direct" },
      { s1: "COMMENTS / REMARKS", ours: "customerMessage · description", kind: "direct" },
      { s1: "ISACTIVE / BOOL01-04", ours: "1 / 0", required: true, kind: "constant" },
      { s1: "REFCODE", ours: "WorkOrder.number", kind: "direct" },
    ],
    lines: {
      table: "CNTRLINES", caption: "Γραμμές σύμβασης (υπηρεσία + διάρκεια + είδη)",
      fields: [
        { s1: "LINENUM", ours: "9000001+", required: true, kind: "constant" },
        { s1: "LINETYPE1", ours: "1 (αφορά υπηρεσίες)", required: true, kind: "constant" },
        { s1: "MSODTYPE / MTRL", ours: "52 + softoneMtrl της υπηρεσίας (offer line) · 51 + είδος", required: true, kind: "derived", note: "η υπηρεσία της προσφοράς πρέπει να έχει MTRL" },
        { s1: "FROMDATE / TODATE", ours: "όπως η σύμβαση", kind: "derived" },
        { s1: "VISITUNIT / VISITNUM", ours: "visitUnitMonths / warrantyMonths", kind: "param", note: "διάρκεια εγγύησης" },
        { s1: "PERIODINV", ours: "0 (εφάπαξ)", kind: "constant" },
        { s1: "QTY1 / QTY2", ours: "1 / 1", required: true, kind: "constant" },
        { s1: "PRICE", ours: "customerPrice (Α) · supplierPrice (Β)", required: true, kind: "direct" },
        { s1: "GUARANTY", ours: "—", kind: "gap", note: "Προαιρετικό: πίνακας εγγυήσεων SoftOne" },
        { s1: "COMMENTS", ours: "offer.description", kind: "direct" },
        { s1: "ISACTIVE", ours: "1", required: true, kind: "constant" },
      ],
    },
    prerequisites: ["CUSTOMER & SUPPLIER συγχρονισμένοι", "PRJC κτηρίου", "SERVICE (MTRL) της υπηρεσίας", "CNTRTYPE Α/Β", "$SrvTimeUnit «μήνες»"],
  },
  {
    key: "property-service", ours: "PropertyService (πακέτο υπηρεσιών)", object: "CNTR", table: "CNTR", caption: "Σύμβαση διαχείρισης (περιοδική)", linkField: "PropertyService.softoneCntr",
    description: "Το πακέτο υπηρεσιών κάθε ακινήτου → Ειδική σύμβαση με διάρκεια και περιοδική τιμολόγηση (PERIODINV = μήνας): μία γραμμή ανά υπηρεσία του πακέτου, ποσότητα = μονάδες, τιμή = μηνιαία.",
    fields: [
      { s1: "CODE / NAME", ours: "codePrefixProject + κτήριο + υπηρεσία", required: true, kind: "derived" },
      { s1: "FROMDATE / TODATE", ours: "startedAt / endedAt", required: true, kind: "direct" },
      { s1: "CNTRTYPE", ours: "SoftoneSettings.cntrTypeManaged", required: true, kind: "param" },
      { s1: "TSODTYPE / TRDR", ours: "13 + Customer.softoneTrdr", required: true, kind: "derived" },
      { s1: "PRJC", ours: "Building.softonePrjc", kind: "derived" },
    ],
    lines: {
      table: "CNTRLINES", caption: "Γραμμές περιοδικής χρέωσης",
      fields: [
        { s1: "MSODTYPE / MTRL", ours: "52 + Service.softoneMtrl", required: true, kind: "derived" },
        { s1: "PERIODINV", ours: "1 (μηνιαία)", kind: "constant" },
        { s1: "VISITUNIT / VISITNUM", ours: "μήνες / διάρκεια σύμβασης", kind: "param" },
        { s1: "QTY1", ours: "μονάδες κτηρίου (CORE) ή 1", required: true, kind: "derived" },
        { s1: "PRICE", ours: "Service.price", required: true, kind: "direct" },
      ],
    },
    prerequisites: ["CUSTOMER", "PRJC", "SERVICE (MTRL)", "CNTRTYPE διαχείρισης"],
  },
  {
    key: "service-invoice", ours: "ServiceInvoice", object: "SALDOC", table: "FINDOC", caption: "Τιμολόγια πώλησης (προς πελάτες)", linkField: "ServiceInvoice.softoneFindoc",
    description: "Το μηνιαίο τιμολόγιο υπηρεσιών προς πελάτη → Παραστατικό πώλησης με γραμμές υπηρεσιών (SRVLINES) και αναφορά στη σύμβαση (CNTR) και το έργο (PRJC). Φάση 3.",
    fields: [
      { s1: "SERIES", ours: "SoftoneSettings.seriesSales", required: true, kind: "param" },
      { s1: "TRDR", ours: "Customer.softoneTrdr", required: true, kind: "derived" },
      { s1: "TRNDATE", ours: "issuedAt", required: true, kind: "direct" },
      { s1: "CNTR / PRJC", ours: "PropertyService.softoneCntr / Building.softonePrjc", kind: "derived" },
      { s1: "COMMENTS", ours: "period", kind: "direct" },
    ],
    lines: { table: "SRVLINES", caption: "Γραμμές υπηρεσιών", fields: [
      { s1: "MTRL / VAT / QTY1 / PRICE", ours: "line.service.softoneMtrl / vatMap / qty / unitPrice", required: true, kind: "derived" },
    ] },
    prerequisites: ["SERIES πώλησης", "CUSTOMER", "SERVICE"],
  },
  {
    key: "expense", ours: "BuildingExpense (με προμηθευτή μητρώου)", object: "PURDOC", table: "FINDOC", caption: "Παραστατικά αγοράς (τιμολόγια συνεργατών)", linkField: "BuildingExpense.softoneFindoc",
    description: "Τιμολόγιο συνεργάτη προς την εταιρεία (μετά την παραλαβή σύμβασης έργου) → Παραστατικό αγοράς με CNTR = σύμβαση Β. Φάση 3.",
    fields: [
      { s1: "SERIES", ours: "SoftoneSettings.seriesPurchase", required: true, kind: "param" },
      { s1: "TRDR", ours: "Supplier.softoneTrdr", required: true, kind: "derived" },
      { s1: "TRNDATE / FINCODE", ours: "date / invoiceNumber", required: true, kind: "direct" },
      { s1: "CNTR", ours: "WorkOrder.softoneCntrB", kind: "derived" },
      { s1: "SUMAMNT", ours: "amount", kind: "direct" },
    ],
    prerequisites: ["SERIES αγοράς", "SUPPLIER", "CNTR-B"],
  },
];

/** Lookups whose SoftOne ids must be filled in Παράμετροι before any sync. */
export const PARAMETER_LOOKUPS = [
  { key: "countryGr", editor: "COUNTRY", label: "Χώρα (Ελλάδα)" },
  { key: "currencyEur", editor: "SOCURRENCY", label: "Νόμισμα (EUR)" },
  { key: "paymentDefault", editor: "PAYMENT", label: "Τρόπος πληρωμής (προεπιλογή)" },
  { key: "cntrTypeCustomer", editor: "CNTRTYPE", label: "Τύπος σύμβασης Α (πελάτης)" },
  { key: "cntrTypeSupplier", editor: "CNTRTYPE", label: "Τύπος σύμβασης Β (συνεργάτης)" },
  { key: "cntrTypeManaged", editor: "CNTRTYPE", label: "Τύπος σύμβασης διαχείρισης" },
  { key: "cntrType1Default", editor: "$CNTRTYPE1", label: "Χαρακτηρισμός σύμβασης" },
  { key: "visitUnitMonths", editor: "$SrvTimeUnit", label: "Μονάδα χρόνου «μήνες»" },
  { key: "seriesSales", editor: "SERIES", label: "Σειρά τιμολογίων πώλησης" },
  { key: "seriesPurchase", editor: "SERIES", label: "Σειρά παραστατικών αγοράς" },
  { key: "prjType", editor: "$PRJTYPE", label: "Τύπος έργου (κτήρια)" },
] as const;
