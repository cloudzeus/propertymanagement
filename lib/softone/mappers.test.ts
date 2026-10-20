import { describe, it, expect } from "vitest";
import { mapCustomer, mapBuilding, mapService, mapWorkOrder, mapPropertyService, CONSTANTS, type S1Params } from "./mappers";

const P: S1Params = {
  countryGr: 1000, currencyEur: 100, paymentDefault: 1000, cntrTypeCustomer: 1, cntrTypeSupplier: 2, cntrTypeManaged: 3, cntrType1Default: 1,
  visitUnitMonths: 2, seriesSales: 7000, seriesPurchase: 7020, prjType: 1, vatMap: { "24": 1410, "13": 1420, "0": 1400 }, unitMap: { "τεμ.": 101, "μήνας": 105 },
  codePrefixCustomer: "PM-C-", codePrefixSupplier: "PM-S-", codePrefixProject: "PM-B-", codePrefixService: "PM-SRV-", branch: 1000,
};
const customer = { id: "c1", code: null, name: "ΑΒΓ ΙΚΕ", afm: "123456789", doy: "Α' ΑΘΗΝΩΝ", address: "Οδός 1", postalCode: "10431", city: "Αθήνα", district: "Αττική", phone: "210", fax: null, email: "a@b.gr", webpage: null, isActive: true, type: "COMPANY", remarks: null, softoneTrdr: null, seq: 7 };

describe("mapCustomer", () => {
  it("builds an insert with generated code and parameters", () => {
    const r = mapCustomer(customer, P);
    expect(r.action).toBe("insert");
    expect(r.missing).toEqual([]);
    const row = r.data.CUSTOMER[0];
    expect(row.CODE).toBe("PM-C-00007");
    expect(row.COUNTRY).toBe(1000);
    expect(row.ISACTIVE).toBe(1);
    expect("CHKAFM" in row).toBe(false);
    expect("FAX" in row).toBe(false); // nulls dropped
  });
  it("flags missing parameters and marks update when TRDR known", () => {
    const r = mapCustomer({ ...customer, afm: null, softoneTrdr: 55 }, { ...P, countryGr: null });
    expect(r.action).toBe("update");
    expect(r.key).toBe(55);
    expect(r.missing).toContain("Παράμετρος «Χώρα (Ελλάδα)»");
    expect(r.data.CUSTOMER[0].CHKAFM).toBe(0);
  });
});

describe("mapBuilding", () => {
  it("needs the customer TRDR first", () => {
    const r = mapBuilding({ id: "b1", name: "Κτήριο", address: "Οδός 2", city: "Αθήνα", postalCode: "11111", floors: 5, unitsCount: 12, hasElevator: true, softonePrjc: null, customerTrdr: null, managedSince: "2026-01-01", seq: 3 }, P);
    expect(r.missing).toEqual(["Ο πελάτης του κτηρίου δεν έχει συγχρονιστεί (TRDR)"]);
    expect(r.data.PRJC[0].CODE).toBe("PM-B-00003");
    expect(r.data.PRJC[0].FROMDATE).toBe("2026-01-01");
  });
});

describe("mapService", () => {
  it("resolves VAT and unit via the parameter maps", () => {
    const r = mapService({ id: "s1", code: "CORE", name: "Βασική διαχείριση", vatPct: 24, unit: "μήνας", customerPrice: 10, supplierPrice: null, active: true, softoneMtrl: null }, P);
    expect(r.missing).toEqual([]);
    expect(r.data.SERVICE[0]).toMatchObject({ CODE: "CORE", VAT: 1410, MTRUNIT1: 105, MTRTYPE: CONSTANTS.MTRTYPE_SERVICE, PRICER: 10 });
  });
  it("reports unmapped VAT/unit", () => {
    const r = mapService({ id: "s1", code: "X", name: "X", vatPct: 17, unit: "ώρα", customerPrice: 1, supplierPrice: 1, active: true, softoneMtrl: null }, P);
    expect(r.missing).toHaveLength(2);
  });
});

describe("mapWorkOrder", () => {
  const wo = { id: "w1", number: "WO-2026-0001", title: "Επισκευή", description: "Αλλαγή λάμπας", createdAt: "2026-03-01", customerAcceptedAt: "2026-03-02", supplierAcceptedAt: "2026-03-02", scheduledAt: null, completedAt: "2026-03-05", warrantyMonths: 6, customerPrice: 120, supplierPrice: 100, customerMessage: null, customerTrdr: 10, supplierTrdr: 20, buildingPrjc: 30, serviceMtrl: 40, softoneCntrA: null, softoneCntrB: null };
  it("produces two back-to-back contracts with the right counterparties", () => {
    const { a, b } = mapWorkOrder(wo, P);
    expect(a.data.CNTR[0]).toMatchObject({ CODE: "WO-2026-0001-A", TSODTYPE: 13, TRDR: 10, CNTRTYPE: 1, CNTRVALUE: 120, VARCHAR01: "w1", TODATE: "2026-09-05" });
    expect(b.data.CNTR[0]).toMatchObject({ CODE: "WO-2026-0001-B", TSODTYPE: 12, TRDR: 20, CNTRTYPE: 2, CNTRVALUE: 100 });
    expect(a.data.CNTRLINES[0]).toMatchObject({ LINENUM: 9000001, MSODTYPE: 52, MTRL: 40, PERIODINV: 0, VISITNUM: 6, PRICE: 120 });
    expect(a.missing).toEqual([]);
    expect(b.missing).toEqual(["Η σύμβαση Α πρέπει να έχει σταλεί πρώτα (CNTRS → Α)"]);
  });
  it("links B to A once A exists", () => {
    const { b } = mapWorkOrder({ ...wo, softoneCntrA: 777 }, P);
    expect(b.data.CNTR[0].CNTRS).toBe(777);
    expect(b.missing).toEqual([]);
  });
});

describe("mapPropertyService", () => {
  it("is a monthly periodic contract", () => {
    const r = mapPropertyService({ id: "ps1", buildingName: "Κτήριο", serviceName: "Βασική", serviceMtrl: 40, price: 2.5, qty: 12, startedAt: "2026-01-01", endedAt: "2026-12-31", customerTrdr: 10, buildingPrjc: 30, softoneCntr: null, seq: 3 }, P);
    expect(r.missing).toEqual([]);
    expect(r.data.CNTRLINES[0]).toMatchObject({ PERIODINV: 1, QTY1: 12, PRICE: 2.5, VISITNUM: 12 });
    expect(r.data.CNTR[0].CNTRTYPE).toBe(3);
  });
});
