import { useNavigate } from "react-router";
import SavedCollection from "../components/SavedCollection";
import { useHistory } from "../context/history";
import { useWorkspace } from "../context/workspace";
import type { SavedItem } from "../types";

export default function HistoryPage() {
  const navigate = useNavigate();
  const { items, deleteItem, clearAll } = useHistory();
  const { applyHistoryItem } = useWorkspace();

  const handleApplyItem = (item: SavedItem) => {
    applyHistoryItem(item);
    navigate("/");
  };

  return (
    <main className="flex-1 max-w-[1280px] w-full mx-auto p-4 sm:px-6 sm:pb-10">
      <SavedCollection
        items={items}
        onApplyItem={handleApplyItem}
        onDeleteItem={deleteItem}
        onClearAll={clearAll}
        layout="page"
      />
    </main>
  );
}
