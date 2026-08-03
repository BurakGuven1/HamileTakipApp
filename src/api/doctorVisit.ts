import { supabase } from "@/lib/supabase";

export type DoctorVisitSubject = "pregnancy" | "baby" | "postpartum_mother";
export type DoctorVisitPeriodDays = 7 | 30;
export type DoctorVisitItemType = "question" | "symptom" | "medication" | "note";
export type PregnancyMeasurementSource = "self" | "health_team";

export type DoctorVisitItem = {
  id: string;
  item_type: DoctorVisitItemType;
  title: string;
  details: string | null;
  severity: number | null;
  started_at: string | null;
  resolved_at: string | null;
  answer: string | null;
  created_at: string;
};

export type DoctorVisitPeriod = {
  days: DoctorVisitPeriodDays;
  start_date: string;
  end_date: string;
  timezone: "Europe/Istanbul";
};

export type DoctorVisitProfile = {
  id: string;
  display_name?: string | null;
  mother_name?: string | null;
  due_date?: string | null;
  is_pregnant?: boolean | null;
  feeding_mode?: "breastfeeding" | "pumping" | "mixed" | "formula" | null;
};

export type DoctorVisitBaby = {
  id: string;
  name: string;
  birth_date: string;
  age_days: number;
};

type DoctorVisitSnapshotBase = {
  subject: DoctorVisitSubject;
  generated_at: string;
  period: DoctorVisitPeriod;
  profile: DoctorVisitProfile;
  baby: DoctorVisitBaby | null;
  items: DoctorVisitItem[];
};

export type PregnancyWeightRecord = {
  id: string;
  record_date: string;
  weight_kg: number;
  notes: string | null;
};

export type PregnancyDailyCounter = {
  counter_date: string;
  kick_count: number;
  contraction_count: number;
};

export type PregnancyVaccinationRecord = {
  id: string;
  vaccine_name: string;
  recommended_week_start: number;
  recommended_week_end: number;
  scheduled_date: string;
  completed: boolean;
  completed_date: string | null;
  notes: string | null;
};

export type PregnancyVisitMeasurement = {
  id: string;
  measured_at: string;
  source: PregnancyMeasurementSource;
  systolic_bp: number | null;
  diastolic_bp: number | null;
  pulse_bpm: number | null;
  fundal_height_cm: number | null;
  fetal_heart_rate_bpm: number | null;
  notes: string | null;
};

export type PregnancyDoctorVisitSnapshot = DoctorVisitSnapshotBase & {
  subject: "pregnancy";
  baby: null;
  pregnancy_age: {
    week: number;
    day_of_week: number;
    gestation_day: number;
  } | null;
  weight_records: PregnancyWeightRecord[];
  daily_counters: PregnancyDailyCounter[];
  vaccinations: PregnancyVaccinationRecord[];
  measurements: PregnancyVisitMeasurement[];
};

export type BabyCareCoverage = {
  has_records: boolean;
  record_count: number;
  recorded_days: number;
  first_record_at: string | null;
  last_record_at: string | null;
};

export type BabyCareDay = {
  record_date: string;
  breastfeeding_count: number;
  bottle_count: number;
  bottle_amount_ml: number | null;
  sleep_count: number;
  sleep_minutes: number | null;
  diaper_count: number;
  medicine_count: number;
  solid_food_count: number;
  temperature_count: number;
};

export type BabyTemperatureRecord = {
  id: string;
  occurred_at: string;
  temperature_c: number | null;
  temperature_site: string | null;
  notes: string | null;
};

export type BabyMedicineRecord = {
  id: string;
  occurred_at: string;
  medicine_name: string | null;
  medicine_dose: string | null;
  notes: string | null;
};

export type BabyGrowthRecord = {
  id: string;
  record_date: string;
  weight_kg: number | null;
  height_cm: number | null;
  head_circumference_cm: number | null;
  notes: string | null;
};

export type BabyVaccinationRecord = {
  id: string;
  vaccine_name: string;
  dose_number: number;
  scheduled_date: string;
  completed: boolean;
  completed_date: string | null;
  notes: string | null;
};

export type BabyDoctorVisitSnapshot = DoctorVisitSnapshotBase & {
  subject: "baby";
  baby: DoctorVisitBaby;
  care_coverage: BabyCareCoverage;
  care_daily: BabyCareDay[];
  temperatures: BabyTemperatureRecord[];
  medicines: BabyMedicineRecord[];
  growth_records: BabyGrowthRecord[];
  vaccinations: BabyVaccinationRecord[];
};

export type MotherWellbeingRecord = {
  id: string;
  checkin_date: string;
  mood: number;
  rest: number;
  self_care_note: string | null;
};

export type PumpingSummary = {
  has_records: boolean;
  record_count: number;
  total_amount_ml: number | null;
  total_duration_minutes: number | null;
  first_record_at: string | null;
  last_record_at: string | null;
};

export type PostpartumMotherDoctorVisitSnapshot = DoctorVisitSnapshotBase & {
  subject: "postpartum_mother";
  baby: DoctorVisitBaby;
  postpartum_days: number;
  wellbeing: MotherWellbeingRecord[];
  pumping_summary: PumpingSummary;
};

export type DoctorVisitSnapshot =
  | PregnancyDoctorVisitSnapshot
  | BabyDoctorVisitSnapshot
  | PostpartumMotherDoctorVisitSnapshot;

export type CreateDoctorVisitItemInput = {
  profileId: string;
  babyId?: string | null;
  subject: DoctorVisitSubject;
  itemType: DoctorVisitItemType;
  title: string;
  details?: string | null;
  severity?: number | null;
  startedAt?: string | null;
};

export type CreatePregnancyVisitMeasurementInput = {
  profileId: string;
  measuredAt?: string;
  source: PregnancyMeasurementSource;
  systolicBp?: number | null;
  diastolicBp?: number | null;
  pulseBpm?: number | null;
  fundalHeightCm?: number | null;
  fetalHeartRateBpm?: number | null;
  notes?: string | null;
};

export type FamilyFeatureCreditReservation = {
  allowed: boolean;
  isPremium: boolean;
  remaining: number | null;
  reason: string | null;
  reservationId: string | null;
};

type RpcResult = Promise<{
  data: unknown;
  error: { message: string; details?: string | null } | null;
}>;

type MutationResult = Promise<{
  data: unknown;
  error: { message: string; details?: string | null } | null;
}>;

type UntypedMutationTable = {
  insert: (values: Record<string, unknown>) => {
    select: (columns?: string) => {
      single: () => MutationResult;
    };
  };
};

function callRpc(name: string, args: Record<string, unknown>): RpcResult {
  return supabase.rpc(name as never, args as never) as unknown as RpcResult;
}

function fromUntyped(name: string) {
  const client = supabase as unknown as {
    from: (table: string) => UntypedMutationTable;
  };
  return client.from(name);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function parseCreditReservation(raw: unknown): FamilyFeatureCreditReservation {
  const parsed = parseMaybeJson(raw);
  const first = Array.isArray(parsed) ? parsed[0] : parsed;
  const value = asRecord(first);

  if (!value) {
    throw new Error("Kullanım hakkı yanıtı okunamadı.");
  }

  const remainingValue = value.remaining ?? value.remaining_credits;
  const remaining = typeof remainingValue === "number" && Number.isFinite(remainingValue)
    ? remainingValue
    : null;
  const reasonValue = value.reason;
  const reservationValue = value.reservation_id ?? value.reservationId;

  return {
    allowed: value.allowed === true,
    isPremium: value.is_premium === true || value.isPremium === true,
    remaining,
    reason: typeof reasonValue === "string" ? reasonValue : null,
    reservationId: typeof reservationValue === "string" ? reservationValue : null
  };
}

function assertSnapshotStructure(
  value: unknown,
  subject: DoctorVisitSubject
): asserts value is DoctorVisitSnapshot {
  const record = asRecord(value);
  const profile = asRecord(record?.profile);
  const period = asRecord(record?.period);
  if (
    !record
    || record.subject !== subject
    || typeof record.generated_at !== "string"
    || !profile
    || typeof profile.id !== "string"
    || !period
    || typeof period.start_date !== "string"
    || typeof period.end_date !== "string"
    || (period.days !== 7 && period.days !== 30)
    || !Array.isArray(record.items)
  ) {
    throw new Error("Doktor görüşmesi özeti okunamadı.");
  }

  if (subject === "pregnancy") {
    if (
      !Array.isArray(record.weight_records)
      || !Array.isArray(record.daily_counters)
      || !Array.isArray(record.vaccinations)
      || !Array.isArray(record.measurements)
    ) {
      throw new Error("Hamilelik görüşmesi verileri eksik geldi. Lütfen yeniden deneyin.");
    }
    return;
  }

  const baby = asRecord(record.baby);
  if (!baby || typeof baby.id !== "string" || typeof baby.name !== "string") {
    throw new Error("Bebek görüşmesi bağlamı okunamadı.");
  }

  if (subject === "baby") {
    if (
      !asRecord(record.care_coverage)
      || !Array.isArray(record.care_daily)
      || !Array.isArray(record.temperatures)
      || !Array.isArray(record.medicines)
      || !Array.isArray(record.growth_records)
      || !Array.isArray(record.vaccinations)
    ) {
      throw new Error("Bebek görüşmesi verileri eksik geldi. Lütfen yeniden deneyin.");
    }
    return;
  }

  if (
    typeof record.postpartum_days !== "number"
    || !Array.isArray(record.wellbeing)
    || !asRecord(record.pumping_summary)
  ) {
    throw new Error("Doğum sonrası anne görüşmesi verileri eksik geldi. Lütfen yeniden deneyin.");
  }
}

export async function getDoctorVisitSnapshot(
  subject: DoctorVisitSubject,
  babyId: string | null,
  days: DoctorVisitPeriodDays
) {
  const { data, error } = await callRpc("get_doctor_visit_snapshot", {
    p_subject: subject,
    p_baby_id: subject === "pregnancy" ? null : babyId,
    p_days: days
  });
  if (error) throw error;

  const parsed = parseMaybeJson(data);
  assertSnapshotStructure(parsed, subject);
  return parsed;
}

export async function createDoctorVisitItem(input: CreateDoctorVisitItemInput) {
  const title = input.title.trim();
  if (!title) throw new Error("Başlık boş bırakılamaz.");

  const { data, error } = await fromUntyped("doctor_visit_items")
    .insert({
      profile_id: input.profileId,
      baby_id: input.subject === "pregnancy" ? null : input.babyId ?? null,
      subject: input.subject,
      item_type: input.itemType,
      title,
      details: input.details?.trim() || null,
      severity: input.itemType === "symptom" ? input.severity ?? null : null,
      started_at: input.startedAt ?? null
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as DoctorVisitItem;
}

export async function createPregnancyVisitMeasurement(
  input: CreatePregnancyVisitMeasurementInput
) {
  const hasSystolic = input.systolicBp != null;
  const hasDiastolic = input.diastolicBp != null;
  if (hasSystolic !== hasDiastolic) {
    throw new Error("Tansiyon için büyük ve küçük değer birlikte girilmeli.");
  }

  if (
    !hasSystolic
    && input.pulseBpm == null
    && input.fundalHeightCm == null
    && input.fetalHeartRateBpm == null
  ) {
    throw new Error("En az bir ölçüm girin.");
  }

  assertMeasurementValue(input.systolicBp, 40, 300, "Büyük tansiyon", true);
  assertMeasurementValue(input.diastolicBp, 20, 200, "Küçük tansiyon", true);
  assertMeasurementValue(input.pulseBpm, 20, 250, "Nabız", true);
  assertMeasurementValue(input.fundalHeightCm, 1, 80, "Fundal yükseklik", false);
  assertMeasurementValue(input.fetalHeartRateBpm, 30, 260, "Fetal kalp hızı", true);

  const { data, error } = await fromUntyped("pregnancy_visit_measurements")
    .insert({
      profile_id: input.profileId,
      measured_at: input.measuredAt ?? new Date().toISOString(),
      source: input.source,
      systolic_bp: input.systolicBp ?? null,
      diastolic_bp: input.diastolicBp ?? null,
      pulse_bpm: input.pulseBpm ?? null,
      fundal_height_cm: input.fundalHeightCm ?? null,
      fetal_heart_rate_bpm: input.fetalHeartRateBpm ?? null,
      notes: input.notes?.trim() || null
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as PregnancyVisitMeasurement;
}

export async function reserveDoctorVisitReportCredit(
  operationId: string,
  lifeStage: "pregnancy" | "postpartum"
) {
  const { data, error } = await callRpc("reserve_family_feature_credit", {
    p_feature_key: "doctor_visit_report",
    p_operation_id: operationId,
    p_life_stage: lifeStage
  });
  if (error) throw error;
  return parseCreditReservation(data);
}

export async function commitDoctorVisitReportCredit(operationId: string) {
  const { data, error } = await callRpc("commit_family_feature_credit", {
    p_operation_id: operationId
  });
  if (error) throw error;
  const result = parseCreditReservation(data);
  if (!result.allowed) {
    if (result.reason === "reservation_expired") {
      throw new Error("PDF hazırlama süresi doldu. Kullanım hakkınız düşmedi; lütfen yeniden deneyin.");
    }
    throw new Error("PDF kullanım hakkı kesinleştirilemedi. Lütfen yeniden deneyin.");
  }
  return result;
}

export async function releaseDoctorVisitReportCredit(operationId: string) {
  const { data, error } = await callRpc("release_family_feature_credit", {
    p_operation_id: operationId
  });
  if (error) throw error;
  return parseCreditReservation(data);
}

function assertMeasurementValue(
  value: number | null | undefined,
  minimum: number,
  maximum: number,
  label: string,
  integerOnly: boolean
) {
  if (value == null) return;
  if (
    !Number.isFinite(value)
    || value < minimum
    || value > maximum
    || (integerOnly && !Number.isInteger(value))
  ) {
    throw new Error(`${label} değerini ve birimini kontrol edin.`);
  }
}
