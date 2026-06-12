"use server";

import { revalidatePath } from "next/cache";
import {
  getMyProfile,
  isHandleAvailable,
  replaceAiStack,
  updateProfile,
} from "@/lib/services/profiles";
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

  const me = await getMyProfile();
  if (!me) return { error: "You must be signed in." };
  const oldHandle = me.handle;

  // Friendly pre-check; the DB unique constraint is the real guard (handled below).
  if (!(await isHandleAvailable(v.handle, me.id))) {
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
  const stackResult = await replaceAiStack(stack);
  if (!stackResult.ok) {
    return {
      error: "Profile saved, but the AI Stack couldn't update. Try again.",
    };
  }

  revalidatePath("/settings/profile");
  revalidatePath(`/u/${v.handle}`);
  // Handle changed → the old public URL must drop its stale cache too.
  if (oldHandle !== v.handle) revalidatePath(`/u/${oldHandle}`);
  return { success: true };
}
