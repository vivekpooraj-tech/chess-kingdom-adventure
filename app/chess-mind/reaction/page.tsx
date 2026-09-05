import { ReactionTrainer } from "@/components/chessMind/ReactionTrainer";

export const metadata = {
  title: "Reaction · Chess Mind",
  description: "Recognise the winning move quickly — measured accuracy and reaction time.",
};

export default function ReactionPage() {
  return <ReactionTrainer />;
}
