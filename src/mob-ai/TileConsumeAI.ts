import { SETTINGS, TileInfoConst, TileTypeConst, randFloat } from "webgl-test-shared";
// import Mob from "../entities/mobs/Mob";
// import AI from "./AI";
import { MobAIType } from "../mob-ai-types";
import Board from "../Board";

// interface FoodSource {
//    /** Amount of food given by eating the source */
//    readonly foodUnits: number;
// }

// export interface TileFoodSource extends FoodSource {
//    /** What the tile turns into after being eaten */
//    readonly resultingTileType: TileTypeConst;
//    /** Time it takes to eat the tile */
//    readonly grazeTime: number;
//    /** Amount of health restored to the entity when eating a tile */
//    readonly healAmount: number;
// }

// interface TileConsumeAIParams {
//    readonly acceleration: number;
//    readonly terminalVelocity: number;
//    readonly tileTargets?: ReadonlyMap<TileTypeConst, TileFoodSource>;
// }

// class TileConsumeAI extends AI implements TileConsumeAIParams {
//    /** Cooldown in seconds between grazes that the mob can't graze */
//    private static readonly GRAZE_COOLDOWN_RANGE = [20, 30] as const;
   
//    public readonly type = MobAIType.tileConsume;

//    public readonly acceleration: number;
//    public readonly terminalVelocity: number;
//    public readonly tileTargets: ReadonlyMap<TileTypeConst, TileFoodSource>;

//    private grazeTimer: number = 0;
//    private grazeCooldown = randFloat(TileConsumeAI.GRAZE_COOLDOWN_RANGE[0], TileConsumeAI.GRAZE_COOLDOWN_RANGE[1]);

//    constructor(mob: Mob, aiParams: TileConsumeAIParams) {
//       super(mob);

//       this.acceleration = aiParams.acceleration;
//       this.terminalVelocity = aiParams.terminalVelocity;
//       this.tileTargets = typeof aiParams.tileTargets !== "undefined" ? aiParams.tileTargets : new Map();
//    }

//    protected onActivation(): void {
//       if (this.isOnGrazeableTile()) {
//          this.grazeTimer = this.tileTargets.get(this.mob.tile.type)!.grazeTime;
//       }

//       this.mob.acceleration.x = 0;
//       this.mob.acceleration.y = 0;
//    }

//    public tick(): void {
//       super.tick();

//       if (this.isOnGrazeableTile()) {
//          this.grazeTimer -= 1 / SETTINGS.TPS;
//          if (this.grazeTimer <= 0) {
//             const foodInfo = this.tileTargets.get(this.mob.tile.type)!;
//             this.graze(foodInfo);
//          }
//       }
//    }
   
//    private isOnGrazeableTile(): boolean {
//       return this.tileTargets.has(this.mob.tile.type);
//    }

//    private graze(foodInfo: TileFoodSource): void {
//       const healthComponent = this.mob.forceGetComponent("health");
//       healthComponent.heal(foodInfo.healAmount);
      
//       const previousTile = this.mob.tile;
//       const newTileInfo: TileInfoConst = {
//          type: foodInfo.resultingTileType,
//          biomeName: previousTile.biomeName,
//          isWall: previousTile.isWall
//       };
//       Board.replaceTile(previousTile.x, previousTile.y, newTileInfo.type, newTileInfo.biomeName, newTileInfo.isWall, 0);

//       this.grazeCooldown = randFloat(TileConsumeAI.GRAZE_COOLDOWN_RANGE[0], TileConsumeAI.GRAZE_COOLDOWN_RANGE[1]);
//    }

//    public getGrazeProgress(): number {
//       if (!this.tileTargets.has(this.mob.tile.type)) {
//          return -1;
//       }

//       return 1 - this.grazeTimer / this.tileTargets.get(this.mob.tile.type)!.grazeTime;
//    }

//    public canSwitch(): boolean {
//       return this.isOnGrazeableTile() && this.grazeCooldown === 0;
//    }
// }

// export default TileConsumeAI;