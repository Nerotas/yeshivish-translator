import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import useMediaQuery from "@mui/material/useMediaQuery";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import {
  fetchGlossary,
  GLOSSARY_STALE_TIME_MS,
  glossaryQueryKey,
  type GlossaryTerm,
} from "./api";
import { usePronunciationPreference } from "./pronunciation-context";

interface GlossaryRow extends GlossaryTerm {
  displayTerm: string;
  variantText: string;
  meaningText: string;
  searchText: string;
}

function EmptyGlossary() {
  return <div className="empty-glossary">No glossary terms were found.</div>;
}

export default function GlossaryPage() {
  const { preference } = usePronunciationPreference();
  const isMobile = useMediaQuery("(max-width:700px)");
  const [selectedTerm, setSelectedTerm] = useState<GlossaryRow | null>(null);
  const glossary = useQuery({
    queryKey: glossaryQueryKey,
    queryFn: fetchGlossary,
    staleTime: GLOSSARY_STALE_TIME_MS,
    retry: 1,
  });

  const rows = useMemo<GlossaryRow[]>(
    () =>
      (glossary.data?.results ?? []).map((entry) => {
        const displayTerm = entry.display_terms[preference];
        const variantText = entry.variants.join(", ");
        const meaningText = entry.meanings.join("; ");
        return {
          ...entry,
          displayTerm,
          variantText,
          meaningText,
          searchText: [
            displayTerm,
            entry.term,
            variantText,
            meaningText,
            entry.context_note,
            entry.category,
            entry.language_origin,
            entry.yeshivish_example,
            entry.plain_english_example,
          ].join(" "),
        };
      }),
    [glossary.data, preference],
  );

  const columns = useMemo<GridColDef<GlossaryRow>[]>(
    () => [
      {
        field: "displayTerm",
        headerName: "Term",
        minWidth: 145,
        flex: 0.8,
      },
      {
        field: "variantText",
        headerName: "Alternate spellings",
        minWidth: 190,
        flex: 1,
      },
      {
        field: "meaningText",
        headerName: "Meanings",
        minWidth: 260,
        flex: 1.8,
      },
      {
        field: "category",
        headerName: "Category",
        minWidth: 165,
        flex: 1,
      },
      {
        field: "language_origin",
        headerName: "Origin",
        minWidth: 100,
        flex: 0.6,
      },
      {
        field: "details",
        headerName: "Details",
        sortable: false,
        filterable: false,
        width: 92,
        renderCell: ({ row }) => (
          <Button size="small" onClick={() => setSelectedTerm(row)}>
            Details
          </Button>
        ),
      },
      { field: "searchText", headerName: "Search text" },
    ],
    [],
  );

  if (glossary.isLoading) {
    return (
      <section className="glossary-page" aria-labelledby="glossary-heading">
        <h1 id="glossary-heading">Yeshivish glossary</h1>
        <p role="status">Loading glossary…</p>
      </section>
    );
  }

  if (glossary.isError) {
    return (
      <section className="glossary-page" aria-labelledby="glossary-heading">
        <h1 id="glossary-heading">Yeshivish glossary</h1>
        <p role="alert" className="error">
          {glossary.error instanceof Error
            ? glossary.error.message
            : "Unable to load the glossary."}
        </p>
      </section>
    );
  }

  return (
    <section className="glossary-page" aria-labelledby="glossary-heading">
      <p className="eyebrow">Terms used by the translator</p>
      <h1 id="glossary-heading">Yeshivish glossary</h1>
      <p className="glossary-intro">
        Browse {glossary.data?.count ?? 0} terms. Search includes alternate
        spellings, meanings, context, category, origin, and examples.
      </p>

      <div className="glossary-grid" data-testid="glossary-grid">
        <DataGrid
          aria-label="Yeshivish glossary terms"
          rows={rows}
          columns={columns}
          showToolbar
          disableRowSelectionOnClick
          disableColumnSelector
          getRowHeight={() => "auto"}
          pageSizeOptions={[10, 25, 50]}
          initialState={{
            pagination: { paginationModel: { page: 0, pageSize: 10 } },
            filter: {
              filterModel: {
                items: [],
                quickFilterExcludeHiddenColumns: false,
              },
            },
          }}
          columnVisibilityModel={{
            searchText: false,
            variantText: !isMobile,
            category: !isMobile,
            language_origin: !isMobile,
          }}
          slots={{ noRowsOverlay: EmptyGlossary }}
          slotProps={{
            toolbar: {
              showQuickFilter: true,
              quickFilterProps: { debounceMs: 200 },
            },
          }}
          sx={{
            borderColor: "var(--border)",
            color: "var(--text)",
            backgroundColor: "var(--surface)",
            "& .MuiDataGrid-columnHeaders": {
              color: "var(--text-h)",
              backgroundColor: "var(--surface-muted)",
            },
            "& .MuiDataGrid-cell": {
              alignItems: "flex-start",
              paddingBlock: "0.75rem",
              whiteSpace: "normal",
              lineHeight: 1.4,
            },
            "& .MuiTablePagination-root, & .MuiInputBase-root, & .MuiButton-root": {
              color: "var(--text)",
            },
          }}
        />
      </div>

      <Dialog
        open={selectedTerm !== null}
        onClose={() => setSelectedTerm(null)}
        fullWidth
        maxWidth="sm"
        aria-labelledby="glossary-detail-title"
      >
        {selectedTerm && (
          <>
            <DialogTitle id="glossary-detail-title">
              {selectedTerm.displayTerm}
            </DialogTitle>
            <DialogContent dividers>
              {selectedTerm.variantText && (
                <p><strong>Alternate spellings:</strong> {selectedTerm.variantText}</p>
              )}
              <p><strong>Meanings:</strong> {selectedTerm.meaningText}</p>
              <p><strong>Context:</strong> {selectedTerm.context_note}</p>
              {selectedTerm.yeshivish_example && (
                <p><strong>Yeshivish example:</strong> {selectedTerm.yeshivish_example}</p>
              )}
              {selectedTerm.plain_english_example && (
                <p><strong>Plain-English example:</strong> {selectedTerm.plain_english_example}</p>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSelectedTerm(null)}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </section>
  );
}
