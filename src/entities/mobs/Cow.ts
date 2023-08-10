import { CowSpecies, Point, randInt, SETTINGS } from "webgl-test-shared";
import Board from "../../Board";
import HealthComponent from "../../entity-components/HealthComponent";
import ItemCreationComponent from "../../entity-components/ItemCreationComponent";
import RectangularHitbox from "../../hitboxes/RectangularHitbox";
import Mob from "./Mob";
import EscapeAI from "../../mob-ai/EscapeAI";
import BerryBushShakeAI from "../../mob-ai/BerryBushShakeAI";
import ItemConsumeAI from "../../mob-ai/ItemConsumeAI";
import TileConsumeAI from "../../mob-ai/TileConsumeAI";
import HerdAI from "../../mob-ai/HerdAI";
import FollowAI from "../../mob-ai/FollowAI";
import WanderAI from "../../mob-ai/WanderAI";

class Cow extends Mob {
   private static readonly MAX_HEALTH = 10;

   public species: CowSpecies;

   private numFootstepsTaken = 0;

   constructor(position: Point, isNaturallySpawned: boolean) {
      super(position, {
         health: new HealthComponent(Cow.MAX_HEALTH, false),
         item_creation: new ItemCreationComponent()
      }, "cow", SETTINGS.TILE_SIZE * 4, isNaturallySpawned);

      this.species = Math.random() < 0.5 ? CowSpecies.brown : CowSpecies.black;

      this.setAIParam("hunger", randInt(0, 50));
      this.setAIParam("metabolism", 2.5);

      this.addAI(new WanderAI(this, {
         aiWeightMultiplier: 0.5,
         wanderRate: 0.6,
         acceleration: 100,
         terminalVelocity: 50
      }));

      this.addAI(new FollowAI(this, {
         aiWeightMultiplier: 0.75,
         acceleration: 50,
         terminalVelocity: 25,
         minDistanceFromFollowTarget: 100,
         weightBuildupTime: 10,
         interestDuration: 7,
         chanceToGainInterest: 0.2,
         followableEntityTypes: new Set(["player", "tribesman", "zombie"])
      }));

      const herdAI = new HerdAI(this, {
         aiWeightMultiplier: 1,
         acceleration: 100,
         terminalVelocity: 50,
         minSeperationDistance: 150,
         turnRate: 0.2,
         maxWeightInflenceCount: 3,
         weightInfluenceFalloff: {
            start: 5,
            duration: 2
         },
         validHerdMembers: new Set(["cow"]),
         seperationInfluence: 0.7,
         alignmentInfluence: 0.5,
         cohesionInfluence: 0.3
      });
      herdAI.herdMemberHash = this.species;
      this.addAI(herdAI);

      this.addAI(new TileConsumeAI(this, {
         aiWeightMultiplier: 1.25,
         acceleration: 100,
         terminalVelocity: 50,
         tileTargets: new Map([
            ["grass", {
               resultingTileType: "dirt",
               foodUnits: 100,
               grazeTime: 5,
               healAmount: 3
            }]
         ])
      }));

      this.addAI(new ItemConsumeAI(this, {
         aiWeightMultiplier: 1.25,
         acceleration: 100,
         terminalVelocity: 50,
         metabolism: 1,
         itemTargets: new Set(["berry"])
      }));

      this.addAI(new BerryBushShakeAI(this, {
         aiWeightMultiplier: 1.1
      }));

      this.addAI(new EscapeAI(this, {
         aiWeightMultiplier: 1.5,
         acceleration: 200,
         terminalVelocity: 200,
         attackSubsideTime: 5,
         escapeHealthThreshold: Cow.MAX_HEALTH
      }));

      this.addHitboxes([
         new RectangularHitbox({
            type: "rectangular",
            width: 50,
            height: 100
         })
      ]);

      this.rotation = 2 * Math.PI * Math.random();

      this.getComponent("item_creation")!.createItemOnDeath("raw_beef", randInt(1, 2), true);
      this.getComponent("item_creation")!.createItemOnDeath("leather", randInt(0, 2), true);

      this.createEvent("hurt", (_1, _2, _knockback: number, hitDirection: number | null): void => {
         for (let i = 0; i < 2; i++) {
            this.createBloodPoolParticle();
         }

         if (hitDirection !== null) {
            for (let i = 0; i < 10; i++) {
               this.createBloodParticle(hitDirection);
            }
         }
      });
   }

   public tick(): void {
      super.tick();

      // Create footsteps
      if (this.acceleration !== null && this.velocity !== null && Board.tickIntervalHasPassed(0.3)) {
         this.createFootprintParticle(this.numFootstepsTaken, 20, 1, 5);

         this.numFootstepsTaken++;
      }
   }

   public getClientArgs(): [species: CowSpecies] {
      return [this.species];
   }
}

export default Cow;