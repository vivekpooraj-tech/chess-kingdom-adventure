import { TabPageShell } from "@/components/nav/TabPageShell";
import { PlayModePresentation } from "@/components/play/PlayModePresentation";
import { ClassicPlaySections } from "@/components/play/classic/ClassicPlaySections";
import { AdultPlaySections } from "@/components/play/adult/AdultPlaySections";
import { KidsPlaySections } from "@/components/play/kids/KidsPlaySections";

export default function PlayPage() {
  return (
    <TabPageShell maxWidth="wide" contentClassName="play-mode-scope">
      <PlayModePresentation
        classicPro={<ClassicPlaySections />}
        adult={<AdultPlaySections />}
        kids={<KidsPlaySections />}
      />
    </TabPageShell>
  );
}
