import { COLLISION_BITS, DEFAULT_COLLISION_MASK, EntityTypeConst, FishColour, ItemType, PlayerCauseOfDeath, Point, SETTINGS, TileType, TileTypeConst, customTickIntervalHasPassed } from "webgl-test-shared";
// import Mob from "./Mob";
// import HealthComponent from "../../entity-components/OldHealthComponent";
// import ItemCreationComponent from "../../entity-components/ItemCreationComponent";
import RectangularHitbox from "../../hitboxes/RectangularHitbox";
// import WanderAI from "../../mob-ai/WanderAI";
// import HerdAI from "../../mob-ai/HerdAI";
// import FlailAI from "../../mob-ai/FlailAI";
import { MobAIType } from "../../mob-ai-types";
import Board from "../../Board";
// import EscapeAI from "../../mob-ai/EscapeAI";
// import MinionAI from "../../mob-ai/MinionAI";

const NUM_FISH_COLOURS = Object.keys(FishColour).length / 2;

// class Fish extends Mob {
//    private static readonly WIDTH = 7 * 4;
//    private static readonly HEIGHT = 14 * 4;
   
//    private static readonly MAX_HEALTH = 5;

//    private static readonly ACCELERATION = 40;
//    private static readonly TERMINAL_VELOCITY = 40;

//    private static readonly HERD_PREDICTION_TIME_SECONDS = 0.5;

//    private readonly colour: FishColour;

//    public mass = 0.5;

//    public secondsOutOfWater = 0;

//    public readonly collisionBit = COLLISION_BITS.other;
//    public readonly collisionMask = DEFAULT_COLLISION_MASK;

//    private readonly herdAI: HerdAI;
   
//    constructor(position: Point) {
//       super(position, {
//          health: new HealthComponent(Fish.MAX_HEALTH, false),
//          item_creation: new ItemCreationComponent(20)
//       }, EntityTypeConst.fish, 200);

//       this.colour = Math.floor(Math.random() * NUM_FISH_COLOURS);
//       this.herdMemberHash = this.colour;
//       this.overrideMoveSpeedMultiplier = true;

//       this.forceGetComponent("item_creation").createItemOnDeath(ItemType.raw_fish, 1, false);

//       const hitbox = new RectangularHitbox(this, 0, 0, Fish.WIDTH, Fish.HEIGHT);
//       this.addHitbox(hitbox);

//       this.addAI(new MinionAI(this, {
//          acceleration: Fish.ACCELERATION,
//          terminalVelocity: Fish.TERMINAL_VELOCITY
//       }));

//       this.addAI(new FlailAI(this, {
//          flailForce: 200,
//          flailIntervalSeconds: 0.75
//       }));

//       this.addAI(new EscapeAI(this, {
//          acceleration: Fish.ACCELERATION,
//          terminalVelocity: Fish.TERMINAL_VELOCITY,
//          attackSubsideTime: 3,
//          escapeHealthThreshold: Fish.MAX_HEALTH
//       }));

//       this.herdAI = new HerdAI(this, {
//          acceleration: Fish.ACCELERATION,
//          terminalVelocity: Fish.TERMINAL_VELOCITY,
//          minSeperationDistance: 150,
//          turnRate: 0.5,
//          minActivateAmount: 1,
//          maxActivateAmount: 6,
//          validHerdMembers: new Set([EntityTypeConst.fish]),
//          seperationInfluence: 0.7,
//          alignmentInfluence: 0.5,
//          cohesionInfluence: 0.3
//       });
//       this.addAI(this.herdAI);

//       this.addAI(new WanderAI(this, {
//          acceleration: Fish.ACCELERATION,
//          terminalVelocity: Fish.TERMINAL_VELOCITY,
//          wanderRate: 0.5,
//          validTileTargets: [TileTypeConst.water],
//          strictValidation: true,
//          tileValidationPadding: 20
//       }));

//       this.rotation = 2 * Math.PI * Math.random();
//    }

//    public tick(): void {
//       this.overrideMoveSpeedMultiplier = this.tile.type === TileTypeConst.water;

//       const predictedX = this.position.x + this.velocity.x * Fish.HERD_PREDICTION_TIME_SECONDS;
//       const predictedY = this.position.y + this.velocity.y * Fish.HERD_PREDICTION_TIME_SECONDS;
//       if (predictedX >= 0 && predictedX < SETTINGS.BOARD_DIMENSIONS && predictedY >= 0 && predictedY < SETTINGS.BOARD_DIMENSIONS) {
//          // If going to move into water tile, don't allow using herd ai
//          const predictedTile = Board.getTile(Math.floor(predictedX / SETTINGS.TILE_SIZE), Math.floor(predictedY / SETTINGS.TILE_SIZE));
//          this.herdAI.isEnabled = predictedTile.type === TileTypeConst.water;
//       }
      
//       super.tick();

//       if (this.currentAI !== null && this.currentAI.type !== MobAIType.flail && (this.currentAI.type !== MobAIType.wander || this.currentAI.targetPosition !== null)) {
//          this.rotation += Math.sin(Board.ticks / 5) * 0.05;
//          this.hitboxesAreDirty = true;
//       }

//       if (this.tile.type !== TileTypeConst.water) {
//          this.secondsOutOfWater += 1 / SETTINGS.TPS;
//          if (this.secondsOutOfWater >= 5 && customTickIntervalHasPassed(this.secondsOutOfWater * SETTINGS.TPS, 1.5)) {
//             this.forceGetComponent("health").damage(1, 0, null, null, PlayerCauseOfDeath.lack_of_oxygen, 0);
//          }
//       } else {
//          this.secondsOutOfWater = 0;
//       }
//    }

//    getClientArgs(): [colour: FishColour] {
//       return [this.colour];
//    }
// }

// export default Fish;