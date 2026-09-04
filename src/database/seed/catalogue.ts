import { DosageForm, UnitType } from "../../schemas/products/productSchema.js";

/**
 * Seed catalogue — realistic products for a Nigerian community pharmacy.
 *
 * Ported from the frontend's mock catalogue so the two describe the same shop:
 * the screens were designed against these names, prices and stock levels, and
 * seeding something different would make every layout decision look wrong.
 *
 * Prices are in kobo. The variety is deliberate — some products sit low on
 * stock, some carry expired batches, and several hold more than one batch so
 * FEFO has a real choice to make.
 */

const kobo = (naira: number) => Math.round(naira * 100);

export interface SeedCategory {
    slug: string;
    name: string;
    description: string;
}

export const SEED_CATEGORIES: SeedCategory[] = [
    { slug: "analgesics", name: "Analgesics", description: "Pain relief and antipyretics" },
    { slug: "antibiotics", name: "Antibiotics", description: "Antibacterial medicines" },
    { slug: "antimalarials", name: "Antimalarials", description: "Malaria treatment and prophylaxis" },
    { slug: "vitamins", name: "Vitamins & Supplements", description: "Nutritional supplements" },
    { slug: "gastro", name: "Antacids & GI", description: "Digestive and gastrointestinal" },
    { slug: "respiratory", name: "Respiratory", description: "Asthma, cough and cold" },
    { slug: "cardio", name: "Cardiovascular", description: "Blood pressure and heart" },
    { slug: "ophthalmic", name: "Ophthalmic", description: "Eye preparations" },
    { slug: "derma", name: "Dermatology", description: "Skin preparations" },
    { slug: "firstaid", name: "First Aid", description: "Dressings and antiseptics" },
];

export const SEED_SUPPLIERS = [
    "Emzor Pharmaceuticals",
    "Fidson Healthcare",
    "May & Baker Nigeria",
    "Swiss Pharma Nigeria",
    "Juhel Nigeria",
    "Dana Pharmaceuticals",
    "GSK Nigeria",
    "Neimeth International",
];

export interface SeedProduct {
    slug: string;
    name: string;
    genericName: string | null;
    brandName: string | null;
    barcode: string | null;
    categorySlug: string;
    strength: string | null;
    dosageForm: DosageForm | null;
    sellingPrice: number;
    minimumStockLevel: number;
    unitType: UnitType;
}

const product = (
    slug: string,
    name: string,
    genericName: string | null,
    brandName: string | null,
    barcode: string | null,
    categorySlug: string,
    strength: string | null,
    dosageForm: DosageForm | null,
    priceNaira: number,
    minimumStockLevel: number,
    unitType: UnitType = "PACK"
): SeedProduct => ({
    slug,
    name,
    genericName,
    brandName,
    barcode,
    categorySlug,
    strength,
    dosageForm,
    sellingPrice: kobo(priceNaira),
    minimumStockLevel,
    unitType,
});

export const SEED_PRODUCTS: SeedProduct[] = [
    // Analgesics
    product("prd-001", "Paracetamol 500mg", "Paracetamol", "Emzor", "6151234567890", "analgesics", "500mg", "TABLET", 800, 15),
    product("prd-002", "Panadol Extra", "Paracetamol + Caffeine", "Panadol", "6151234567891", "analgesics", "500mg/65mg", "TABLET", 1500, 20),
    product("prd-003", "Ibuprofen 400mg", "Ibuprofen", "Emzor", "6151234567892", "analgesics", "400mg", "TABLET", 1200, 15),
    product("prd-004", "Diclofenac 50mg", "Diclofenac Sodium", "Cataflam", "6151234567893", "analgesics", "50mg", "TABLET", 1800, 10),
    product("prd-005", "Aspirin 75mg", "Acetylsalicylic Acid", "Ecotrin", "6151234567894", "analgesics", "75mg", "TABLET", 900, 12),

    // Antibiotics
    product("prd-010", "Amoxicillin 500mg", "Amoxicillin", "Emzor", "6151234567900", "antibiotics", "500mg", "CAPSULE", 2000, 20),
    product("prd-011", "Augmentin 625mg", "Amoxicillin + Clavulanate", "Augmentin", "6151234567901", "antibiotics", "625mg", "TABLET", 8500, 10),
    product("prd-012", "Ciprofloxacin 500mg", "Ciprofloxacin", "Ciprotab", "6151234567902", "antibiotics", "500mg", "TABLET", 2500, 12),
    product("prd-013", "Metronidazole 400mg", "Metronidazole", "Flagyl", "6151234567903", "antibiotics", "400mg", "TABLET", 1200, 15),
    product("prd-014", "Ampiclox 500mg", "Ampicillin + Cloxacillin", "Ampiclox", "6151234567904", "antibiotics", "500mg", "CAPSULE", 2200, 15),
    product("prd-015", "Azithromycin 500mg", "Azithromycin", "Zithromax", "6151234567905", "antibiotics", "500mg", "TABLET", 4500, 8),

    // Antimalarials
    product("prd-020", "Coartem 20/120mg", "Artemether + Lumefantrine", "Coartem", "6151234567910", "antimalarials", "20mg/120mg", "TABLET", 4500, 15),
    product("prd-021", "Lonart DS", "Artemether + Lumefantrine", "Lonart", "6151234567911", "antimalarials", "80mg/480mg", "TABLET", 5500, 12),
    product("prd-022", "Amatem Softgel", "Artemether + Lumefantrine", "Amatem", "6151234567912", "antimalarials", "20mg/120mg", "CAPSULE", 3800, 10),
    product("prd-023", "Fansidar", "Sulfadoxine + Pyrimethamine", "Fansidar", "6151234567913", "antimalarials", "500mg/25mg", "TABLET", 1500, 10),

    // Vitamins & supplements
    product("prd-030", "Vitamin C 1000mg", "Ascorbic Acid", "Emzor", "6151234567920", "vitamins", "1000mg", "TABLET", 2000, 20),
    product("prd-031", "Folic Acid 5mg", "Folic Acid", "Emzor", "6151234567921", "vitamins", "5mg", "TABLET", 700, 15),
    product("prd-032", "Ferrous Sulphate 200mg", "Ferrous Sulphate", "Fersolate", "6151234567922", "vitamins", "200mg", "TABLET", 1100, 12),
    product("prd-033", "Zinc Sulphate 20mg", "Zinc Sulphate", "Zincovit", "6151234567923", "vitamins", "20mg", "TABLET", 1300, 10),
    product("prd-034", "Multivite Syrup", "Multivitamin", "Astyfer", "6151234567924", "vitamins", "200ml", "SYRUP", 2800, 8, "BOTTLE"),

    // GI
    product("prd-040", "Omeprazole 20mg", "Omeprazole", "Losec", "6151234567930", "gastro", "20mg", "CAPSULE", 2400, 12),
    product("prd-041", "Gestid Suspension", "Antacid", "Gestid", "6151234567931", "gastro", "200ml", "SUSPENSION", 1900, 10, "BOTTLE"),
    product("prd-042", "Buscopan 10mg", "Hyoscine Butylbromide", "Buscopan", "6151234567932", "gastro", "10mg", "TABLET", 2600, 10),
    product("prd-043", "ORS Sachet", "Oral Rehydration Salts", "Emzor", "6151234567933", "gastro", "20.5g", "POWDER", 300, 40, "SACHET"),

    // Respiratory
    product("prd-050", "Ventolin Inhaler", "Salbutamol", "Ventolin", "6151234567940", "respiratory", "100mcg", "INHALER", 6500, 6, "PIECE"),
    product("prd-051", "Piriton 4mg", "Chlorpheniramine", "Piriton", "6151234567941", "respiratory", "4mg", "TABLET", 800, 15),
    product("prd-052", "Loratadine 10mg", "Loratadine", "Clarityn", "6151234567942", "respiratory", "10mg", "TABLET", 1600, 12),
    product("prd-053", "Benylin Cough Syrup", "Diphenhydramine", "Benylin", "6151234567943", "respiratory", "100ml", "SYRUP", 2900, 8, "BOTTLE"),

    // Cardiovascular
    product("prd-060", "Amlodipine 5mg", "Amlodipine", "Norvasc", "6151234567950", "cardio", "5mg", "TABLET", 2200, 12),
    product("prd-061", "Lisinopril 10mg", "Lisinopril", "Zestril", "6151234567951", "cardio", "10mg", "TABLET", 2600, 10),
    product("prd-062", "Metformin 500mg", "Metformin", "Glucophage", "6151234567952", "cardio", "500mg", "TABLET", 1800, 12),

    // Ophthalmic / derma / first aid
    product("prd-070", "Chloramphenicol Eye Drops", "Chloramphenicol", "Optachlor", "6151234567960", "ophthalmic", "0.5%", "DROPS", 1400, 8, "BOTTLE"),
    product("prd-071", "Ciclopirox Cream", "Ciclopirox Olamine", "Batrafen", "6151234567961", "derma", "1%", "CREAM", 3200, 6, "TUBE"),
    product("prd-072", "Gentian Violet", "Gentian Violet", null, "6151234567962", "derma", "30ml", "DROPS", 600, 10, "BOTTLE"),
    product("prd-073", "Povidone Iodine", "Povidone Iodine", "Betadine", "6151234567963", "firstaid", "60ml", "DROPS", 1800, 8, "BOTTLE"),
    product("prd-074", "Sterile Gauze Pad", null, null, "6151234567964", "firstaid", "10cm x 10cm", null, 500, 20, "PIECE"),
    product("prd-075", "Adhesive Bandage", null, "Band-Aid", "6151234567965", "firstaid", "Assorted", null, 900, 15, "PACK"),
];

/**
 * Batch plan per product, expressed as offsets in days from today so the seed
 * always contains a live spread of expiry bands whenever it is run.
 *
 * `[batchNumber, daysFromToday, quantityRemaining, costNaira]`
 */
export type SeedBatchPlan = readonly [string, number, number, number];

export const SEED_BATCH_PLANS: Record<string, SeedBatchPlan[]> = {
    // Multi-batch products — FEFO has a genuine choice here.
    "prd-001": [["PCM001", 120, 20, 550], ["PCM002", 400, 50, 560]],
    "prd-002": [["PAN221", 14, 14, 1050], ["PAN222", 300, 60, 1080]],
    "prd-010": [["AMX142", 55, 20, 1400], ["AMX23001", 720, 100, 1450]],
    "prd-020": [["CTM088", 25, 18, 3100], ["CTM090", 480, 45, 3200]],
    "prd-030": [["VTC004", 200, 4, 1350]], // low stock
    "prd-013": [["FLG112", 75, 40, 800]],
    "prd-011": [["AUG551", 610, 12, 6200]],
    "prd-012": [["CIP330", 340, 30, 1750]],
    "prd-014": [["APX210", 88, 25, 1550]],
    "prd-015": [["AZI700", 520, 14, 3200]],
    "prd-021": [["LON440", 430, 22, 3900]],
    "prd-022": [["AMT117", 260, 16, 2700]],
    "prd-023": [["FAN201", -12, 8, 1000]], // expired
    "prd-003": [["IBU301", 190, 35, 850]],
    "prd-004": [["DIC120", 45, 22, 1250]],
    "prd-005": [["ASP090", 380, 40, 620]],
    "prd-031": [["FOL010", 500, 60, 480]],
    "prd-032": [["FER220", 150, 30, 760]],
    "prd-033": [["ZNC040", 95, 9, 900]], // low stock
    "prd-034": [["MLV330", 210, 12, 1950]],
    "prd-040": [["OMP440", 350, 26, 1650]],
    "prd-041": [["GST150", 68, 15, 1300]],
    "prd-042": [["BUS080", 290, 18, 1800]],
    "prd-043": [["ORS900", 640, 120, 190]],
    "prd-050": [["VEN110", 410, 7, 4600]],
    "prd-051": [["PIR330", 175, 45, 520]],
    "prd-052": [["LOR220", 320, 24, 1100]],
    "prd-053": [["BEN440", -5, 10, 2000]], // expired
    "prd-060": [["AML550", 460, 28, 1500]],
    "prd-061": [["LIS660", 300, 20, 1800]],
    "prd-062": [["MET770", 240, 32, 1200]],
    "prd-070": [["CHL880", 58, 11, 950]],
    "prd-071": [["CIC990", 520, 8, 2300]],
    "prd-072": [["GEN100", 700, 20, 380]],
    "prd-073": [["POV110", 380, 14, 1250]],
    "prd-074": [["GAU120", 900, 60, 300]],
    // prd-075 deliberately has no batches — an out-of-stock product.
};

export interface SeedUser {
    name: string;
    username: string;
    role: "ADMINISTRATOR" | "CASHIER";
}

export const SEED_USERS: SeedUser[] = [
    { name: "Mustapha Bello", username: "admin", role: "ADMINISTRATOR" },
    { name: "Sarah Adeyemi", username: "sarah", role: "CASHIER" },
    { name: "Ibrahim Musa", username: "ibrahim", role: "CASHIER" },
];

export const SEED_TERMINALS = [
    { id: "trm-01", name: "Terminal 01", location: "Front counter", type: "CHECKOUT" as const },
    { id: "trm-02", name: "Terminal 02", location: "Dispensing bay", type: "DISPENSING" as const },
    { id: "trm-03", name: "Terminal 03", location: "Back office", type: "ADMIN" as const },
];
