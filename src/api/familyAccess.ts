import { supabase } from "@/lib/supabase";
import type { Tables } from "@/types/database";

export type FamilyMember = Tables<"family_members">;
type Profile = Tables<"profiles">;

type FatherCodeLoginResponse = {
  email?: string;
  password?: string;
  profile?: Profile;
};

class FatherCodeFunctionError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "FatherCodeFunctionError";
    this.status = status;
  }
}

export async function redeemFamilyReferralCode(code: string) {
  const { data, error } = await supabase.rpc("redeem_family_referral_code", {
    p_code: code
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function signInFatherWithFamilyCode(code: string) {
  const cleanCode = code.replace(/\D/g, "");

  if (cleanCode.length !== 7) {
    throw new Error("Baba girişi için anneden alınan 7 haneli aile kodu gerekli.");
  }

  const {
    data: { session }
  } = await supabase.auth.getSession();

  let createdSessionForRedeem = false;

  if (!session) {
    const functionProfile = await signInFatherWithFamilyCodeFunction(cleanCode).catch(
      (error) => {
        if (isFatherCodeFunctionUnavailable(error)) {
          return null;
        }

        throw error;
      }
    );

    if (functionProfile) {
      return functionProfile;
    }

    const { error } = await supabase.auth.signInAnonymously();

    if (error) {
      if (/anonymous/i.test(error.message)) {
        throw new Error(
          "Baba koduyla giriş için father-code-login Edge Function deploy edilmeli veya Supabase Auth anonim giriş etkin olmalı."
        );
      }

      throw error;
    }

    createdSessionForRedeem = true;
  }

  try {
    return await redeemFamilyReferralCode(cleanCode);
  } catch (error) {
    if (createdSessionForRedeem) {
      await supabase.auth.signOut().catch(() => undefined);
    }
    throw error;
  }
}

async function signInFatherWithFamilyCodeFunction(code: string) {
  const { data, error } = await supabase.functions.invoke<FatherCodeLoginResponse>(
    "father-code-login",
    {
      body: { code }
    }
  );

  if (error) {
    throw await normalizeFatherCodeFunctionError(error);
  }

  if (!data?.email || !data.password || !data.profile) {
    throw new Error("Baba kodu oturumu başlatılamadı.");
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

function isFatherCodeFunctionUnavailable(error: unknown) {
  return error instanceof FatherCodeFunctionError && error.status === 404;
}

async function normalizeFatherCodeFunctionError(error: unknown) {
  const context =
    typeof error === "object" && error !== null && "context" in error
      ? (error as { context?: { clone?: () => Response; status?: number } }).context
      : undefined;
  const status = typeof context?.status === "number" ? context.status : undefined;
  let message = error instanceof Error ? error.message : "Baba kodu oturumu başlatılamadı.";

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
