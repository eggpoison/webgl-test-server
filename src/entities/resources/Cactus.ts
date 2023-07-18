import { CactusFlowerPositions, CactusFlowerType, Mutable, Point, randFloat, randInt, randItem } from "webgl-test-shared";
import Entity from "../Entity";
import HealthComponent from "../../entity-components/HealthComponent";
import ItemCreationComponent from "../../entity-components/ItemCreationComponent";
import CircularHitbox from "../../hitboxes/CircularHitbox";

const POTENTIAL_FLOWERS: ReadonlyArray<CactusFlowerType> = [CactusFlowerType.pinkRed, CactusFlowerType.pinkYellow, CactusFlowerType.pinkGreen, CactusFlowerType.yellow, CactusFlowerType.white];

const generateRandomFlowers = (): ReadonlyArray<CactusFlowerType> => {
   // Generate random number of flowers from 2 to 7, weighted low
   let numFlowers = 2;
   while (Math.random() < 0.4 && numFlowers < 7) {
      numFlowers++;
   }

   const flowers = new Array<CactusFlowerType>();

   for (let i = 0; i < numFlowers; i++) {
      flowers.push(randItem(POTENTIAL_FLOWERS));
   }

   return flowers;
}

const generateFlowerPositions = (numFlowers: number): CactusFlowerPositions => {
   const remainingFlowerColumns = [0, 1, 2, 3, 4, 5, 6, 7];
   
   const flowerPositions: Mutable<CactusFlowerPositions> = [];
   for (let i = 0; i < numFlowers; i++) {
      // Choose random column for the flower
      const columnIdx = randInt(0, remainingFlowerColumns.length - 1);
      const column = remainingFlowerColumns[columnIdx];
      remainingFlowerColumns.splice(columnIdx, 1);

      const height = randFloat(0.2, 0.8);
      flowerPositions.push([column, height]);
   }

   return flowerPositions;
}

class Cactus extends Entity {
   private static readonly MAX_HEALTH = 25;

   private static readonly RADIUS = 40;

   private readonly flowers: ReadonlyArray<CactusFlowerType>;
   private readonly flowerPositions: CactusFlowerPositions;

   constructor(position: Point) {
      const itemCreationComponent = new ItemCreationComponent();

      super(position, {
         health: new HealthComponent(Cactus.MAX_HEALTH, false),
         item_creation: itemCreationComponent
      }, "cactus");

      this.addHitboxes([
         new CircularHitbox({
            type: "circular",
            radius: Cactus.RADIUS
         })
      ]);

      this.flowers = generateRandomFlowers();
      this.flowerPositions = generateFlowerPositions(this.flowers.length);

      const spineDropCount = randInt(2, 5);
      itemCreationComponent.createItemOnDeath("cactus_spine", spineDropCount);

      this.setIsStatic(true);
      
      this.rotation = 2 * Math.PI * Math.random();
   }

   public getClientArgs(): [flowers: ReadonlyArray<CactusFlowerType>, flowerPositions: CactusFlowerPositions] {
      return [this.flowers, this.flowerPositions];
   }
}

export default Cactus;