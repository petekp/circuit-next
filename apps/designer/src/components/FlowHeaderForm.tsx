import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { Schematic, ValidationIssue } from '@/lib/types';

type Props = {
  schematic: Schematic;
  errorsByPath: Map<string, ValidationIssue[]>;
  onPatch: (patch: Partial<Schematic>) => void;
};

function fieldErrors(
  field: string,
  errs: Map<string, ValidationIssue[]>,
): ValidationIssue[] {
  return errs.get(field) ?? [];
}

export function FlowHeaderForm({ schematic, errorsByPath, onPatch }: Props) {
  return (
    <Card className="m-5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <span>Flow</span>
          <Badge variant="outline" className="font-mono">
            {schematic.id}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Field label="Title" errors={fieldErrors('title', errorsByPath)}>
          <Input
            value={schematic.title}
            onChange={(e) => onPatch({ title: e.target.value })}
          />
        </Field>
        <Field label="Purpose" errors={fieldErrors('purpose', errorsByPath)}>
          <Textarea
            value={schematic.purpose}
            onChange={(e) => onPatch({ purpose: e.target.value })}
            rows={3}
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Status" errors={fieldErrors('status', errorsByPath)}>
            <Select
              value={schematic.status}
              onValueChange={(v) => onPatch({ status: v as Schematic['status'] })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="candidate">candidate</SelectItem>
                <SelectItem value="active">active</SelectItem>
                <SelectItem value="deprecated">deprecated</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Version" errors={fieldErrors('version', errorsByPath)}>
            <Input
              value={schematic.version ?? ''}
              placeholder="0.1.0"
              onChange={(e) =>
                onPatch({ version: e.target.value || undefined })
              }
            />
          </Field>
        </div>
        <div className="border-border grid grid-cols-2 gap-4 border-t pt-4">
          <Field label="Starts at">
            <Input value={schematic.starts_at} readOnly className="font-mono" />
          </Field>
          <Field label="Step count">
            <Input
              value={String(schematic.items?.length ?? 0)}
              readOnly
              className="font-mono"
            />
          </Field>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  errors,
  children,
}: {
  label: string;
  errors?: readonly ValidationIssue[];
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {errors && errors.length > 0 && (
        <ul className="text-destructive space-y-0.5 text-xs">
          {errors.map((e, i) => (
            <li key={i}>{e.message}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
