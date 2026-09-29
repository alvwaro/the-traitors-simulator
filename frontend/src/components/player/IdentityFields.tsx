import { Field, Input } from '../ui/Form';

/** Tamanho máximo do nome de personagem ou jogador (o mesmo limite da API). */
export const PERSON_NAME_MAX_LENGTH = 80;

interface IdentityFieldsProps {
  name: string;
  imageUrl: string;
  onName: (value: string) => void;
  onImageUrl: (value: string) => void;
  nameLabel?: string;
  imageLabel?: string;
  namePlaceholder?: string;
  required?: boolean;
}

/** Nome e foto (link) de um personagem ou jogador. */
export function IdentityFields({
  name,
  imageUrl,
  onName,
  onImageUrl,
  nameLabel = 'Nome',
  imageLabel = 'Link da imagem',
  namePlaceholder,
  required = true,
}: Readonly<IdentityFieldsProps>) {
  return (
    <>
      <Field label={nameLabel}>
        {(id) => <Input id={id} value={name} onChange={(e) => onName(e.target.value)} required={required} maxLength={PERSON_NAME_MAX_LENGTH} placeholder={namePlaceholder} />}
      </Field>
      <Field label={imageLabel}>{(id) => <Input id={id} type="url" value={imageUrl} onChange={(e) => onImageUrl(e.target.value)} placeholder="https://" />}</Field>
    </>
  );
}
