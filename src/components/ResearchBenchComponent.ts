import { RESEARCH_ORB_AMOUNTS, RESEARCH_ORB_COMPLETE_TIME, SettingsConst, getRandomResearchOrbSize } from "webgl-test-shared";
import Entity, { ID_SENTINEL_VALUE } from "../Entity";
import { InventoryUseComponentArray, ResearchBenchComponentArray, TribeComponentArray, TribesmanComponentArray } from "./ComponentArray";
import Board from "../Board";
import { getInventoryUseInfo } from "./InventoryUseComponent";

const ORB_COMPLETE_TICKS = Math.floor(RESEARCH_ORB_COMPLETE_TIME * SettingsConst.TPS);

export class ResearchBenchComponent {
   public isOccupied = false;
   public occupeeID = 0;

   // @Incomplete: reset back to id sentinel value when not looking for a bench
   /** ID of any tribemsan currently on the way to the bench to research */
   public preemptiveOccupeeID = ID_SENTINEL_VALUE;

   public orbCompleteProgressTicks = 0;
}

export function tickResearchBenchComponent(researchBench: Entity): void {
   const researchBenchComponent = ResearchBenchComponentArray.getComponent(researchBench);
   
   // @Speed: This runs every tick, but this condition only activates rarely when the bench is being used.
   if (researchBenchComponent.isOccupied) {
      if (Board.entityRecord.hasOwnProperty(researchBenchComponent.occupeeID)) {
         const tribesman = Board.entityRecord[researchBenchComponent.occupeeID];
         const tribesmanComponent = TribesmanComponentArray.getComponent(tribesman);
         if (tribesmanComponent.targetResearchBenchID !== researchBench.id) {
            researchBenchComponent.occupeeID = ID_SENTINEL_VALUE;
            researchBenchComponent.isOccupied = false;
            researchBenchComponent.orbCompleteProgressTicks = 0;
         }
      } else {
         researchBenchComponent.occupeeID = ID_SENTINEL_VALUE;
         researchBenchComponent.isOccupied = false;
         researchBenchComponent.orbCompleteProgressTicks = 0;
      }
   }
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

// @Cleanup: Should this be in tribesman.ts?
export function continueResearching(bench: Entity, researcher: Entity): void {
   const researchBenchComponent = ResearchBenchComponentArray.getComponent(bench);

   researchBenchComponent.orbCompleteProgressTicks++;
   if (researchBenchComponent.orbCompleteProgressTicks >= ORB_COMPLETE_TICKS) {
      const size = getRandomResearchOrbSize();
      const amount = RESEARCH_ORB_AMOUNTS[size];

      const tribeComponent = TribeComponentArray.getComponent(bench);
      tribeComponent.tribe!.studyTech(researcher.position.x, researcher.position.y, amount);
      
      researchBenchComponent.orbCompleteProgressTicks = 0;

      // Make the tribesman slap the bench each time they complete an orb
      const inventoryUseComponent = InventoryUseComponentArray.getComponent(researcher);
      const useInfo = getInventoryUseInfo(inventoryUseComponent, "hotbar");
      useInfo.lastAttackTicks = Board.ticks;
   }
}