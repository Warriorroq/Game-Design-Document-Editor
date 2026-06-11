import "./App.css";
import { useDocumentStore } from "@/application/document/useDocumentStore";
import { AppMain } from "@/presentation/shell/AppMain";
import { AppProviders } from "@/presentation/shell/AppProviders";

export default function App() {
  const documentStore = useDocumentStore();

  return (
    <AppProviders
      doc={documentStore.doc}
      setActiveSectionId={documentStore.setActiveSectionId}
    >
      <AppMain {...documentStore} />
    </AppProviders>
  );
}
