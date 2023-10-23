import { FishColour, ItemType, PlayerCauseOfDeath, Point, SETTINGS, TileType } from "webgl-test-shared";
import Mob from "./Mob";
import HealthComponent from "../../entity-components/HealthComponent";
import ItemCreationComponent from "../../entity-components/ItemCreationComponent";
import RectangularHitbox from "../../hitboxes/RectangularHitbox";
import WanderAI from "../../mob-ai/WanderAI";
import HerdAI from "../../mob-ai/HerdAI";
import FlailAI from "../../mob-ai/FlailAI";
import { MobAIType } from "../../mob-ai-types";
import Board, { customTickIntervalHasPassed } from "../../Board";
import EscapeAI from "../../mob-ai/EscapeAI";
import MinionAI from "../../mob-ai/MinionAI";

const NUM_FISH_COLOURS = Object.keys(FishColour).length / 2;

class Fish extends Mob {
   private static readonly WIDTH = 7 * 4;
   private static readonly HEIGHT = 14 * 4;
   
   private static readonly MAX_HEALTH = 5;

   private static readonly ACCELERATION = 40;
   private static readonly TERMINAL_VELOCITY = 40;

   private readonly colour: FishColour;

   public mass = 0.5;

   public secondsOutOfWater = 0;
   
   constructor(position: Point) {
      super(position, {
         health: new HealthComponent(Fish.MAX_HEALTH, false),
         item_creation: new ItemCreationComponent(20)
      }, "fish", 200);

      this.colour = Math.floor(Math.random() * NUM_FISH_COLOURS);
      this.herdMemberHash = this.colour;
      this.overrideMoveSpeedMultiplier = true;

      this.forceGetComponent("item_creation").createItemOnDeath(ItemType.raw_fish, 1, false);

      const hitbox = new RectangularHitbox();
      hitbox.setHitboxInfo(Fish.WIDTH, Fish.HEIGHT);
      this.addHitbox(hitbox);

      this.addAI(new MinionAI(this, {
         acceleration: Fish.ACCELERATION,
         terminalVelocity: Fish.TERMINAL_VELOCITY
      }));

      this.addAI(new FlailAI(this, {
         flailForce: 200,
         flailIntervalSeconds: 0.75
      }));

      this.addAI(new EscapeAI(this, {
         acceleration: Fish.ACCELERATION,
         terminalVelocity: Fish.TERMINAL_VELOCITY,
         attackSubsideTime: 3,
         escapeHealthThreshold: Fish.MAX_HEALTH
      }));

      this.addAI(new HerdAI(this, {
         acceleration: Fish.ACCELERATION,
         terminalVelocity: Fish.TERMINAL_VELOCITY,
         minSeperationDistance: 150,
         turnRate: 0.5,
         minActivateAmount: 1,
         maxActivateAmount: 6,
         validHerdMembers: new Set(["fish"]),
         seperationInfluence: 0.7,
         alignmentInfluence: 0.5,
         cohesionInfluence: 0.3
      }));

      this.addAI(new WanderAI(this, {
         acceleration: Fish.ACCELERATION,
         terminalVelocity: Fish.TERMINAL_VELOCITY,
         wanderRate: 0.5,
         validTileTargets: [TileType.water]
      }));

      this.rotation = 2 * Math.PI * Math.random();
   }

   public tick(): void {
      this.overrideMoveSpeedMultiplier = this.tile.type === TileType.water;
      
      super.tick();

      if (this.currentAI !== null && this.currentAI.type !== MobAIType.flail && (this.currentAI.type !== MobAIType.wander || this.currentAI.targetPosition !== null)) {
         this.rotation += Math.sin(Board.ticks / 5) * 0.05;
      }

      if (this.tile.type !== TileType.water) {
         this.secondsOutOfWater += 1 / SETTINGS.TPS;
         if (this.secondsOutOfWater >= 5 && customTickIntervalHasPassed(this.secondsOutOfWater * SETTINGS.TPS, 1.5)) {
            this.forceGetComponent("health").damage(1, 0, null, null, PlayerCauseOfDeath.lack_of_oxygen, 0);
         }
      } else {
         this.secondsOutOfWater = 0;
      }
   }

   getClientArgs(): [colour: FishColour] {
      return [this.colour];
   }
}

export default Fish;