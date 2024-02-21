import { RESEARCH_ORB_AMOUNTS, RESEARCH_ORB_COMPLETE_TIME, SETTINGS, getRandomResearchOrbSize } from "webgl-test-shared";
import Entity, { ID_SENTINEL_VALUE } from "../Entity";
import { ResearchBenchComponentArray, TribeComponentArray } from "./ComponentArray";

const ORB_COMPLETE_TICKS = Math.floor(RESEARCH_ORB_COMPLETE_TIME * SETTINGS.TPS);

export class ResearchBenchComponent {
   public isOccupied = false;
   public occupeeID = 0;

   // @Incomplete: reset back to id sentinel value when not looking for a bench
   /** ID of any tribemsan currently on the way to the bench to research */
   public preemptiveOccupeeID = ID_SENTINEL_VALUE;

   public orbCompleteProgressTicks = 0;
}

export function attemptToOccupyResearchBench(bench: Entity, researcher: Entity): void {
   const researchBenchComponent = ResearchBenchComponentArray.getComponent(bench);
   if (researchBenchComponent.isOccupied) {
      return;
   }

   researchBenchComponent.isOccupied = true;
   researchBenchComponent.occupeeID = researcher.id;
   researchBenchComponent.preemptiveOccupeeID = ID_SENTINEL_VALUE;
}

export function deoccupyResearchBench(bench: Entity, researcher: Entity): void {
   const researchBenchComponent = ResearchBenchComponentArray.getComponent(bench);
   if (researcher.id !== researchBenchComponent.occupeeID) {
      return;
   }

   researchBenchComponent.isOccupied = false;
   // Reset orb complete progress
   researchBenchComponent.orbCompleteProgressTicks = 0;
}

export function canResearchAtBench(bench: Entity, researcher: Entity): boolean {
   const researchBenchComponent = ResearchBenchComponentArray.getComponent(bench);
   return researchBenchComponent.occupeeID === researcher.id;
}

/** Whether or not a tribesman should try to mvoe to research at this bench */
export function shouldMoveToResearchBench(bench: Entity, researcher: Entity): boolean {
   const researchBenchComponent = ResearchBenchComponentArray.getComponent(bench);

   // Try to move if it isn't occupied and isn't being preemprively moved to by another tribesman
   return !researchBenchComponent.isOccupied && (researchBenchComponent.preemptiveOccupeeID === ID_SENTINEL_VALUE || researchBenchComponent.preemptiveOccupeeID === researcher.id);
}

export function markPreemptiveMoveToBench(bench: Entity, researcher: Entity): void {
   const researchBenchComponent = ResearchBenchComponentArray.getComponent(bench);
   researchBenchComponent.preemptiveOccupeeID = researcher.id;
}

export function continueResearching(bench: Entity): void {
   const researchBenchComponent = ResearchBenchComponentArray.getComponent(bench);

   researchBenchComponent.orbCompleteProgressTicks++;
   if (researchBenchComponent.orbCompleteProgressTicks >= ORB_COMPLETE_TICKS) {
      const size = getRandomResearchOrbSize();
      const amount = RESEARCH_ORB_AMOUNTS[size];

      const tribeComponent = TribeComponentArray.getComponent(bench);
      tribeComponent.tribe!.studyTech(amount);
      
      researchBenchComponent.orbCompleteProgressTicks = 0;
   }
}