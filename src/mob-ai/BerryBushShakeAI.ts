import { GameObjectDebugData, SETTINGS } from "webgl-test-shared";
// import BerryBush from "../entities/resources/BerryBush";
// import AI from "./AI";
import Board from "../Board";
import { MobAIType } from "../mob-ai-types";

// class BerryBushShakeAI extends AI {
//    private static readonly SAMPLE_DISTANCE = 60;

//    /** Number of ticks for the entity to shake the berry bush */
//    private static readonly TICKS_TO_SHAKE = 1.5 * SETTINGS.TPS;
   
//    public readonly type = MobAIType.berryBushShake;

//    private target: BerryBush | null = null;

//    private shakeTimer: number = 0;

//    public tick(): void {
//       if (this.target === null) return;

//       super.moveToPosition(this.target.position, 100, 50);

//       const testPositionX = this.mob.position.x + BerryBushShakeAI.SAMPLE_DISTANCE * Math.sin(this.mob.rotation);
//       const testPositionY = this.mob.position.y + BerryBushShakeAI.SAMPLE_DISTANCE * Math.cos(this.mob.rotation);

//       // If the target entity is directly in front of the cow, start eatin it
//       if (Board.positionIsInBoard(testPositionX, testPositionY)) {
//          const entities = Board.getEntitiesAtPosition(testPositionX, testPositionY);
//          if (entities.has(this.target)) {
//             this.shakeTimer++;
//             if (this.shakeTimer >= BerryBushShakeAI.TICKS_TO_SHAKE) {
//                this.shakeBush(this.target);
//                this.shakeTimer = 0;
//             }
//          } else {
//             this.shakeTimer = 0;
//          }
//       } else {
//          this.shakeTimer = 0;
//       }
//    }

//    protected onActivation(): void {
//       this.shakeTimer = 0;
//    }

//    private shakeBush(berryBush: BerryBush): void {
//       berryBush.shake();
//    }

//    public onRefresh(): void {
//       let target: BerryBush | null = null;
//       let minDistance = Number.MAX_SAFE_INTEGER;
//       for (const entity of this.mob.visibleEntities) {
//          if (entity.type === EntityTypeConst.berry_bush && (entity as BerryBush).getNumBerries() > 0) {
//             const distance = this.mob.position.calculateDistanceBetween(entity.position);
//             if (distance < minDistance) {
//                target = entity as BerryBush;
//                minDistance = distance;
//             }
//          }
//       }

//       this.target = target;
//    }

//    public canSwitch(): boolean {
//       if (this.mob.forceGetComponent("hunger").hunger < 80) return false;

//       for (const entity of this.mob.visibleEntities) {
//          if (entity.type === EntityTypeConst.berry_bush && (entity as BerryBush).getNumBerries() > 0) {
//             return true;
//          }
//       }
      
//       return false;
//    }

//    public addDebugData(debugData: GameObjectDebugData): void {
//       if (this.target === null) return;
      
//       debugData.lines.push(
//          {
//             targetPosition: this.target.position.package(),
//             colour: [0, 0, 1],
//             thickness: 2
//          }
//       );
//    }
// }

// export default BerryBushShakeAI;