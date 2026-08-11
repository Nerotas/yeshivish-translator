import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
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
            entry.aleph_beis,
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
        field: "aleph_beis",
        headerName: preference === "shabbos" ? "Aleph Beis" : "Aleph Beit",
        minWidth: 135,
        flex: 0.8,
        renderCell: ({ value }) => <span dir="rtl">{value}</span>,
      },
      {
        field: "meaningText",
        headerName: "Meanings",
        minWidth: 260,
        flex: 2.4,
      },
      {
        field: "details",
        headerName: "More info",
        sortable: false,
        filterable: false,
        align: "center",
        headerAlign: "center",
        width: 88,
        renderCell: ({ row }) => (
          <Tooltip title="View details" arrow>
            <IconButton
              aria-label={`View details for ${row.displayTerm}`}
              size="small"
              onClick={() => setSelectedTerm(row)}
            >
              <svg
                aria-hidden="true"
                focusable="false"
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="currentColor"
              >
                <path d="M11 17h2v-6h-2v6Zm1-15C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2Zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8ZM11 9h2V7h-2v2Z" />
              </svg>
            </IconButton>
          </Tooltip>
        ),
      },
      { field: "searchText", headerName: "Search text" },
    ],
    [preference],
  );

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
      {glossary.isLoading ? (
        <p className="glossary-intro" role="status">
          Loading glossary…
        </p>
      ) : (
        <p className="glossary-intro">
          Browse {glossary.data?.count ?? 0} terms. Search includes Aleph
          Beis/Beit, alternate spellings, meanings, context, category, origin,
          and examples.
        </p>
      )}

      <div className="glossary-grid" data-testid="glossary-grid">
        <DataGrid
          aria-label="Yeshivish glossary terms"
          rows={rows}
          columns={columns}
          loading={glossary.isLoading}
          showToolbar
          disableRowSelectionOnClick
          disableColumnSelector
          getRowHeight={() => "auto"}
          pageSizeOptions={[10, 25, 50, 100]}
          initialState={{
            pagination: { paginationModel: { page: 0, pageSize: 50 } },
            filter: {
              filterModel: {
                items: [],
                quickFilterExcludeHiddenColumns: false,
              },
            },
          }}
          columnVisibilityModel={{ searchText: false }}
          slots={{ noRowsOverlay: EmptyGlossary }}
          slotProps={{
            loadingOverlay: {
              variant: "skeleton",
              noRowsVariant: "skeleton",
            },
            toolbar: {
              showQuickFilter: true,
              quickFilterProps: { debounceMs: 200 },
              csvOptions: { disableToolbarButton: true },
              printOptions: { disableToolbarButton: true },
            },
          }}
          sx={{
            "--DataGrid-t-color-background-base": "var(--surface)",
            "--DataGrid-t-header-background-base": "var(--surface-muted)",
            "--DataGrid-t-cell-background-pinned": "var(--surface)",
            "--DataGrid-t-color-border-base": "var(--border)",
            "--DataGrid-t-color-foreground-base": "var(--text)",
            "--DataGrid-t-color-foreground-muted": "var(--text-muted)",
            "--DataGrid-t-color-foreground-accent": "var(--text-h)",
            borderColor: "var(--border)",
            color: "var(--text)",
            backgroundColor: "var(--surface)",
            "& .MuiDataGrid-columnHeaders, & .MuiDataGrid-columnHeader, & .MuiDataGrid-columnHeaders .MuiDataGrid-filler, & .MuiDataGrid-columnHeaders .MuiDataGrid-scrollbarFiller, & .MuiDataGrid-columnHeader .MuiDataGrid-sortButton": {
              color: "var(--text-h)",
              backgroundColor: "var(--surface-muted)",
            },
            "& .MuiDataGrid-cell": {
              alignItems: "flex-start",
              paddingBlock: "0.75rem",
              whiteSpace: "normal",
              lineHeight: 1.4,
            },
            "& .MuiDataGrid-row:hover": {
              backgroundColor: "var(--surface-muted)",
            },
            "& .MuiTablePagination-root, & .MuiInputBase-root, & .MuiButton-root, & .MuiIconButton-root, & [role='toolbar'] button": {
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
              {selectedTerm.category && (
                <p><strong>Category:</strong> {selectedTerm.category}</p>
              )}
              {selectedTerm.language_origin && (
                <p><strong>Language origin:</strong> {selectedTerm.language_origin}</p>
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
