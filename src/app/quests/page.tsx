import { QuestsView } from "@/components/quests-view";

export const dynamic = "force-dynamic";

export default function QuestsPage() {
  return (
    <div className="px-4 lg:px-6 py-6 max-w-[820px] mx-auto w-full">
      <QuestsView />
    </div>
  );
}
