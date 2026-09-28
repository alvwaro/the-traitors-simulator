import { Field, FormRow, Input, Select } from '../../../components/ui/Form';

export interface PrizeDraft {
  currency: string;
  initialPrizePot: string;
  maxPrizePot: string;
}

const CURRENCIES = [
  { code: 'BRL', label: 'Real (R$)' },
  { code: 'GBP', label: 'Libra (£)' },
  { code: 'USD', label: 'Dólar (US$)' },
  { code: 'EUR', label: 'Euro (€)' },
];

/** Campos de configuração do prêmio, reaproveitados na criação e na edição. */
export function PrizeFields({ value, onChange }: Readonly<{ value: PrizeDraft; onChange: (next: PrizeDraft) => void }>) {
  const set = (patch: Partial<PrizeDraft>) => onChange({ ...value, ...patch });
  return (
    <FormRow>
      <Field label="Moeda">
        {(id) => (
          <Select id={id} value={value.currency} onChange={(e) => set({ currency: e.target.value })}>
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Prêmio inicial">
        {(id) => <Input id={id} type="number" min={0} step="0.01" value={value.initialPrizePot} onChange={(e) => set({ initialPrizePot: e.target.value })} />}
      </Field>
      <Field label="Prêmio máximo">
        {(id) => <Input id={id} type="number" min={0} step="0.01" value={value.maxPrizePot} onChange={(e) => set({ maxPrizePot: e.target.value })} />}
      </Field>
    </FormRow>
  );
}
