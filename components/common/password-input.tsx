"use client";

import { useState } from "react";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";

import { EyeClose, EyeOpen, Lock } from "@/components/icons";

/** Password box with a show/hide eye, matching the login form. */
export function PasswordInput({
  id,
  value,
  onChange,
  disabled,
  autoComplete,
  placeholder = "••••••••",
  invalid,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  autoComplete: "current-password" | "new-password";
  placeholder?: string;
  invalid?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <InputGroup>
      <InputGroupAddon>
        <InputGroupText>
          <Lock />
        </InputGroupText>
      </InputGroupAddon>
      <InputGroupInput
        id={id}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-invalid={invalid}
      />
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          size="icon-xs"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? <EyeClose /> : <EyeOpen />}
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  );
}

/** The sign-up password rule, shown before the person types. */
export const PASSWORD_RULE_HINT =
  "At least 8 characters, with an uppercase letter, a lowercase letter, a number and one of @ $ ! % * ? &";
