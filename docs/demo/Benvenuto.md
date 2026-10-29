---
autore: Folio
tag: [markdown, note, demo]
aggiornato: 2026-10-29
---

# Benvenuto in Folio

Folio legge e scrive i file **Markdown** che hai già sul Mac, senza importarli in un database. Apri una cartella qualsiasi, naviga con la barra laterale e tieni più documenti aperti nelle *tab*.

> [!tip] Scorciatoie utili
> Premi ⌘P per cercare un file in tutto il Mac, ⌘E per passare da lettura a modifica e ⌘⇧F per cercare nel contenuto.

## Cosa sa mostrare

- Collegamenti tra note, come [[Roadmap]] o [un percorso relativo](Diario/2026-10-29.md)
- Liste di attività che si spuntano con un clic
- Codice evidenziato, tabelle, formule e diagrammi

### Attività della settimana

- [x] Riordinare gli appunti del progetto
- [x] Scrivere la bozza della presentazione
- [ ] Rivedere la roadmap con il team

## Codice

```python
def parole(testo: str) -> int:
    """Conta le parole di un documento."""
    return len(testo.split())

print(parole("Folio legge e scrive Markdown"))  # 5
```

## Tabella

| Formato        | Lettura | Modifica |
|----------------|:-------:|:--------:|
| `.md`          | sì      | sì       |
| `.markdown`    | sì      | sì       |
| `.textbundle`  | sì      | sì       |

## Formule

La varianza di un campione è $s^2 = \frac{1}{n-1}\sum_{i=1}^{n}(x_i - \bar{x})^2$.

## Diagrammi

```mermaid
graph LR
  A[Apri cartella] --> B[Leggi]
  B --> C[Modifica]
  C --> D[Salvataggio automatico]
```

Le note a piè di pagina funzionano come ci si aspetta[^1].

[^1]: Anche il front matter YAML in cima al file viene mostrato come tabella di proprietà.
