"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { updateProfileAction } from "@/app/settings/profile/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { ProfileWithStack } from "@/lib/services/profiles";
import {
  type ProfileFormValues,
  profileFormSchema,
} from "@/lib/validation/profile";

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-sm text-destructive" aria-live="polite">
      {message}
    </p>
  );
}

export function ProfileForm({ profile }: { profile: ProfileWithStack }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isDirty },
  } = useForm<ProfileFormValues>({
    resolver: standardSchemaResolver(profileFormSchema),
    mode: "onBlur",
    defaultValues: {
      handle: profile.handle,
      display_name: profile.display_name ?? "",
      bio: profile.bio ?? "",
      avatar_url: profile.avatar_url ?? "",
      hire_me_url: profile.hire_me_url ?? "",
      hire_me_visible: profile.hire_me_visible,
      ai_stack: profile.ai_stack_items.map((it) => ({
        tool_name: it.tool_name,
        skill_level: it.skill_level,
        sort_order: it.sort_order,
      })),
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "ai_stack",
  });

  function onSubmit(values: ProfileFormValues) {
    setServerError(null);
    startTransition(async () => {
      const result = await updateProfileAction(values);
      if (result.fieldError) {
        setError(result.fieldError.field, {
          message: result.fieldError.message,
        });
        return;
      }
      if (result.error) {
        setServerError(result.error);
        toast.error(result.error);
        return;
      }
      toast.success("Profile saved.");
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="flex flex-col gap-8"
    >
      {/* Identity */}
      <section className="glass flex flex-col gap-4 rounded-card p-6">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="handle">Handle</Label>
          <div className="flex items-center gap-2">
            <span className="font-mono text-muted-foreground">@</span>
            <Input
              id="handle"
              autoCapitalize="none"
              autoComplete="off"
              spellCheck={false}
              aria-invalid={errors.handle ? true : undefined}
              aria-describedby={errors.handle ? "handle-error" : undefined}
              {...register("handle")}
            />
          </div>
          <FieldError id="handle-error" message={errors.handle?.message} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="display_name">Display name</Label>
          <Input
            id="display_name"
            aria-invalid={errors.display_name ? true : undefined}
            aria-describedby={
              errors.display_name ? "display_name-error" : undefined
            }
            {...register("display_name")}
          />
          <FieldError
            id="display_name-error"
            message={errors.display_name?.message}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bio">Bio</Label>
          <Textarea
            id="bio"
            rows={3}
            aria-invalid={errors.bio ? true : undefined}
            aria-describedby={errors.bio ? "bio-error" : undefined}
            {...register("bio")}
          />
          <FieldError id="bio-error" message={errors.bio?.message} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="avatar_url">Avatar URL</Label>
          <Input
            id="avatar_url"
            type="url"
            placeholder="https://…"
            aria-invalid={errors.avatar_url ? true : undefined}
            aria-describedby={
              errors.avatar_url ? "avatar_url-error" : undefined
            }
            {...register("avatar_url")}
          />
          <FieldError
            id="avatar_url-error"
            message={errors.avatar_url?.message}
          />
        </div>
      </section>

      {/* Hire me */}
      <section className="glass flex flex-col gap-4 rounded-card p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label htmlFor="hire_me_visible">
              Show "Hire me" on my profile
            </Label>
            <p className="text-sm text-muted-foreground">
              Display a button linking to your hire-me page.
            </p>
          </div>
          <Controller
            control={control}
            name="hire_me_visible"
            render={({ field }) => (
              <Switch
                id="hire_me_visible"
                checked={field.value}
                onCheckedChange={(checked) => field.onChange(checked)}
              />
            )}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="hire_me_url">Hire-me URL</Label>
          <Input
            id="hire_me_url"
            type="url"
            placeholder="https://…"
            aria-invalid={errors.hire_me_url ? true : undefined}
            aria-describedby={
              errors.hire_me_url ? "hire_me_url-error" : undefined
            }
            {...register("hire_me_url")}
          />
          <FieldError
            id="hire_me_url-error"
            message={errors.hire_me_url?.message}
          />
        </div>
      </section>

      {/* AI Stack */}
      <section className="glass flex flex-col gap-4 rounded-card p-6">
        <div>
          <h2 className="font-heading text-lg font-medium">AI Stack</h2>
          <p className="text-sm text-muted-foreground">
            The tools you use, with your skill level (1–5). Order = display
            order.
          </p>
        </div>

        <ul className="flex flex-col gap-3">
          {fields.map((f, i) => (
            <li key={f.id} className="flex items-end gap-2">
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor={`ai_stack.${i}.tool_name`} className="sr-only">
                  Tool name
                </Label>
                <Input
                  id={`ai_stack.${i}.tool_name`}
                  placeholder="e.g. Midjourney"
                  aria-invalid={
                    errors.ai_stack?.[i]?.tool_name ? true : undefined
                  }
                  {...register(`ai_stack.${i}.tool_name`)}
                />
              </div>
              <div className="flex w-24 flex-col gap-1.5">
                <Label
                  htmlFor={`ai_stack.${i}.skill_level`}
                  className="sr-only"
                >
                  Skill level
                </Label>
                <select
                  id={`ai_stack.${i}.skill_level`}
                  className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                  {...register(`ai_stack.${i}.skill_level`, {
                    valueAsNumber: true,
                  })}
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      Lv {n}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label={`Remove tool ${i + 1}`}
                onClick={() => remove(i)}
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() =>
            append({ tool_name: "", skill_level: 3, sort_order: fields.length })
          }
        >
          <Plus className="size-4" aria-hidden="true" />
          Add tool
        </Button>
      </section>

      {serverError ? (
        <p
          className="text-sm text-destructive"
          role="alert"
          aria-live="assertive"
        >
          {serverError}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="submit" size="lg" className="h-11" disabled={isPending}>
          {isPending ? "Saving…" : "Save profile"}
        </Button>
        {isDirty ? (
          <span className="text-sm text-muted-foreground">Unsaved changes</span>
        ) : null}
      </div>
    </form>
  );
}
