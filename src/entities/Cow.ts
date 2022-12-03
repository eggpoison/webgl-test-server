import { CowSpecies, Point } from "webgl-test-shared";
import HealthComponent from "../entity-components/HealthComponent";
import ItemCreationComponent from "../entity-components/ItemCreationComponent";
import Mob from "./Mob";

class Cow extends Mob {
   private static readonly MAX_HEALTH = 10;

   public readonly species: CowSpecies;
   public readonly herdMemberHash: number;

   constructor(position: Point, species: CowSpecies) {
      const itemCreationComponent = new ItemCreationComponent();

      super(position, "cow", {
         health: new HealthComponent(Cow.MAX_HEALTH),
         item_creation: itemCreationComponent
      });
      this.rotation = 2 * Math.PI * Math.random();

      this.species = species;
      this.herdMemberHash = species === CowSpecies.brown ? 0 : 1;

      itemCreationComponent.createItemOnDeath("raw_beef", 3);
   }

   public getClientArgs(): [species: CowSpecies] {
      return [this.species];
   }
}

export default Cow;