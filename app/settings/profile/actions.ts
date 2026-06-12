"use server";

import { revalidatePath } from "next/cache";
import {
  isHandleAvailable,
  replaceAiStack,
  updateProfile,
} from "@/lib/services/profiles";
import { createClient } from "@/lib/supabase/server";
import {
  type ProfileFormState,
  profileFormSchema,
} from "@/lib/validation/profile";

export async function updateProfileAction(
  values: unknown,
): Promise<ProfileFormState> {
  const parsed = profileFormSchema.safeParse(values);
  if (!parsed.success) return { error: "Please fix the highlighted fields." };
  const v = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  // Friendly pre-check; the DB unique constraint is the real guard (handled below).
  if (!(await isHandleAvailable(v.handle, user.id))) {
    return {
      fieldError: { field: "handle", message: "That handle is taken." },
    };
  }

  const result = await updateProfile({
    handle: v.handle,
    display_name: v.display_name.trim() || null,
    bio: v.bio.trim() || null,
    avatar_url: v.avatar_url || null,
    hire_me_url: v.hire_me_url || null,
    hire_me_visible: v.hire_me_visible,
  });
  if (!result.ok) {
    if (result.error === "handle_taken") {
      return {
        fieldError: { field: "handle", message: "That handle is taken." },
      };
    }
    return { error: "Could not save your profile. Please try again." };
  }

  // sort_order follows the visible top-to-bottom order.
  const stack = v.ai_stack.map((it, i) => ({ ...it, sort_order: i }));
  const stackResult = await replaceAiStack(user.id, stack);
  if (!stackResult.ok) {
    return {
      error: "Profile saved, but the AI Stack couldn't update. Try again.",
    };
  }

  revalidatePath("/settings/profile");
  revalidatePath(`/u/${v.handle}`);
  return { success: true };
}
