-- ---------------------------------------------------------------------
-- Casts prontos: cópia congelada de um cast (personagens, fotos, comportamentos
-- e relacionamentos) publicada para qualquer pessoa do site salvar na própria
-- biblioteca. Não guarda ranking nem estatísticas.
-- ---------------------------------------------------------------------
CREATE TABLE published_casts (
    id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    name           VARCHAR(120) NOT NULL,
    description    TEXT,
    image_url      TEXT         CHECK (image_url ~* '^https?://'),
    -- cast da biblioteca que originou a publicação (republicar atualiza a mesma)
    source_cast_id UUID         REFERENCES casts (id) ON DELETE SET NULL,
    snapshot       JSONB        NOT NULL,
    published_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX published_casts_name_uq ON published_casts (lower(name));
CREATE UNIQUE INDEX published_casts_source_uq ON published_casts (source_cast_id) WHERE source_cast_id IS NOT NULL;
