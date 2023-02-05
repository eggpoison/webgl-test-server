import { CowSpecies, Point, SETTINGS } from "webgl-test-shared";
import HealthComponent from "../entity-components/HealthComponent";
import ItemCreationComponent from "../entity-components/ItemCreationComponent";
import RectangularHitbox from "../hitboxes/RectangularHitbox";
import Mob, { MobAIData } from "./Mob";

class Cow extends Mob {
   private static readonly MAX_HEALTH = 10;

   private static readonly MOB_AI_DATA: MobAIData = {
      info: {
         visionRange: SETTINGS.TILE_SIZE * 4
      },
      aiCreationInfo: {
         wander: {
            aiWeightMultiplier: 0.5,
            wanderRate: 0.6,
            acceleration: 100,
            terminalVelocity: 50
         },
         follow: {
            aiWeightMultiplier: 0.75,
            acceleration: 50,
            terminalVelocity: 25,
            minDistanceFromFollowTarget: 100,
            weightBuildupTime: 10,
            interestDuration: 7,
            chanceToGainInterest: 0.2,
            followableEntityTypes: new Set(["player", "zombie"])
         },
         herd: {
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
         },
         starve: {
            aiWeightMultiplier: 1.25,
            acceleration: 100,
            terminalVelocity: 50,
            metabolism: 1,
            traitVariance: 0.3,
            tileTargets: new Map([
               ["grass", {
                  resultingTileType: "dirt",
                  foodUnits: 100,
                  grazeTime: 5
               }]
            ])
         },
         escape: {
            aiWeightMultiplier: 1.5,
            acceleration: 150,
            terminalVelocity: 100,
            attackSubsideTime: 5
         }
      }
   };

   public species: CowSpecies;
   public readonly herdMemberHash: number;

   constructor(position: Point) {
      const itemCreationComponent = new ItemCreationComponent();

      super(position, {
         health: new HealthComponent(Cow.MAX_HEALTH, false),
         item_creation: itemCreationComponent
      }, "cow", Cow.MOB_AI_DATA);

      this.addHitboxes([
         new RectangularHitbox({
            type: "rectangular",
            width: 50,
            height: 100
         })
      ]);

      this.rotation = 2 * Math.PI * Math.random();

      this.species = Math.random() < 0.5 ? CowSpecies.brown : CowSpecies.black;
      this.herdMemberHash = this.species;

      itemCreationComponent.createItemOnDeath("raw_beef", 3);
   }

   public getClientArgs(): [species: CowSpecies] {
      return [this.species];
   }
}

export default Cow;