import { supabase } from "@/lib/supabase";
import type { Tables } from "@/types/database";

export type FamilyMember = Tables<"family_members">;

type FatherCodeLoginResponse = {
  email?: string;
  password?: string;
  profile?: { id: string };
};

export type FamilyMemberRole = "father" | "caregiver";

export type FamilyCodeLoginOptions = {
  displayName: string;
  role: FamilyMemberRole;
};

class FatherCodeFunctionError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "FatherCodeFunctionError";
    this.status = status;
  }
}

export async function signInFatherWithFamilyCode(
  code: string,
  options: FamilyCodeLoginOptions = { displayName: "Baba", role: "father" }
) {
  const cleanCode = code.replace(/\D/g, "");
  const displayName = options.displayName.trim();

  if (cleanCode.length !== 7) {
    throw new Error("Aile girişi için anneden alınan 7 haneli kod gerekli.");
  }

  if (displayName.length < 2 || displayName.length > 40) {
    throw new Error("Aile üyesinin adını 2–40 karakter arasında yazmalısın.");
  }

  return signInFatherWithFamilyCodeFunction(cleanCode, {
    ...options,
    displayName
  });
}

async function signInFatherWithFamilyCodeFunction(
  code: string,
  options: FamilyCodeLoginOptions
) {
  const { data, error } = await supabase.functions.invoke<FatherCodeLoginResponse>(
    "father-code-login",
    {
      body: {
        code,
        displayName: options.displayName,
        role: options.role
      }
    }
  );

  if (error) {
    throw await normalizeFatherCodeFunctionError(error);
  }

  if (!data?.email || !data.password || !data.profile) {
    throw new Error("Aile kodu oturumu başlatılamadı.");
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: data.email,
    password: data.password
  });

  if (signInError) {
    throw signInError;
  }

  return data.profile;
}

async function normalizeFatherCodeFunctionError(error: unknown) {
  const context =
    typeof error === "object" && error !== null && "context" in error
      ? (error as { context?: { clone?: () => Response; status?: number } }).context
      : undefined;
  const status = typeof context?.status === "number" ? context.status : undefined;
  let message = error instanceof Error ? error.message : "Aile kodu oturumu başlatılamadı.";

  if (context?.clone) {
    const body = await context
      .clone()
      .json()
      .catch(() => null);

    if (
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof body.error === "string"
    ) {
      message = body.error;
    }
  }

  return new FatherCodeFunctionError(message, status);
}

export async function getCurrentFamilyMembership() {
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from("family_members")
    .select("*")
    .eq("member_id", user.id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function isCurrentUserFamilyFather() {
  const { data, error } = await supabase.rpc("is_family_father");

  if (error) {
    throw error;
  }

  return Boolean(data);
}
