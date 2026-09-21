import { Screen } from "@/components/layout/Screen";
import { DiscoverModePresentation } from "@/components/discover/DiscoverModePresentation";
import { ClassicDiscoverSections } from "@/components/discover/classic/ClassicDiscoverSections";
import { AdultDiscoverSections } from "@/components/discover/adult/AdultDiscoverSections";
import { KidsDiscoverSections } from "@/components/discover/kids/KidsDiscoverSections";

export default function DiscoverPage() {
  return (
    <Screen maxWidth="medium" contentClassName="discover-mode-scope">
      <DiscoverModePresentation
        classicPro={<ClassicDiscoverSections />}
        adult={<AdultDiscoverSections />}
        kids={<KidsDiscoverSections />}
      />
    </Screen>
  );
}
