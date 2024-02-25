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
   const researchBenchComponent = ResearchBenchComponentArray.getComponent(researchBench.id);
   
   // @Speed: This runs every tick, but this condition only activates rarely when the bench is being used.
   if (researchBenchComponent.isOccupied) {
      if (Board.entityRecord.hasOwnProperty(researchBenchComponent.occupeeID)) {
         const tribesman = Board.entityRecord[researchBenchComponent.occupeeID];
         const tribesmanComponent = TribesmanComponentArray.getComponent(tribesman.id);
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

export function attemptToOccupyResearchBench(researchBench: Entity, researcher: Entity): void {
   const researchBenchComponent = ResearchBenchComponentArray.getComponent(researchBench.id);
   if (researchBenchComponent.isOccupied) {
      return;
   }

   researchBenchComponent.isOccupied = true;
   researchBenchComponent.occupeeID = researcher.id;
   researchBenchComponent.preemptiveOccupeeID = ID_SENTINEL_VALUE;
}

export function deoccupyResearchBench(researchBench: Entity, researcher: Entity): void {
   const researchBenchComponent = ResearchBenchComponentArray.getComponent(researchBench.id);
   if (researcher.id !== researchBenchComponent.occupeeID) {
      return;
   }

   researchBenchComponent.isOccupied = false;
   // Reset orb complete progress
   researchBenchComponent.orbCompleteProgressTicks = 0;
}

export function canResearchAtBench(researchBench: Entity, researcher: Entity): boolean {
   const researchBenchComponent = ResearchBenchComponentArray.getComponent(researchBench.id);
   return researchBenchComponent.occupeeID === researcher.id;
}

/** Whether or not a tribesman should try to mvoe to research at this bench */
export function shouldMoveToResearchBench(researchBench: Entity, researcher: Entity): boolean {
   const researchBenchComponent = ResearchBenchComponentArray.getComponent(researchBench.id);

   // Try to move if it isn't occupied and isn't being preemprively moved to by another tribesman
   return !researchBenchComponent.isOccupied && (researchBenchComponent.preemptiveOccupeeID === ID_SENTINEL_VALUE || researchBenchComponent.preemptiveOccupeeID === researcher.id);
}

export function markPreemptiveMoveToBench(researchBench: Entity, researcher: Entity): void {
   const researchBenchComponent = ResearchBenchComponentArray.getComponent(researchBench.id);
   researchBenchComponent.preemptiveOccupeeID = researcher.id;
}

// @Cleanup: Should this be in tribesman.ts?
export function continueResearching(researchBench: Entity, researcher: Entity): void {
   const researchBenchComponent = ResearchBenchComponentArray.getComponent(researchBench.id);

   researchBenchComponent.orbCompleteProgressTicks++;
   if (researchBenchComponent.orbCompleteProgressTicks >= ORB_COMPLETE_TICKS) {
      const size = getRandomResearchOrbSize();
      const amount = RESEARCH_ORB_AMOUNTS[size];

      const tribeComponent = TribeComponentArray.getComponent(researchBench.id);
      tribeComponent.tribe!.studyTech(researcher.position.x, researcher.position.y, amount);
      
      researchBenchComponent.orbCompleteProgressTicks = 0;

      // Make the tribesman slap the bench each time they complete an orb
      const inventoryUseComponent = InventoryUseComponentArray.getComponent(researcher.id);
      const useInfo = getInventoryUseInfo(inventoryUseComponent, "hotbar");
      useInfo.lastAttackTicks = Board.ticks;
   }
}