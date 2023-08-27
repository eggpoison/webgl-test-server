import { ItemType, ParticleType, Point, randFloat, randInt, TreeSize, Vector } from "webgl-test-shared";
import HealthComponent from "../../entity-components/HealthComponent";
import ItemCreationComponent from "../../entity-components/ItemCreationComponent";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import Entity from "../Entity";
import Particle from "../../Particle";

class Tree extends Entity {
   private static readonly MAX_HEALTH = 10;

   /** Amount of wood created by the tree when it is killed */
   private static readonly WOOD_DROP_AMOUNT_RECORD: { [T in TreeSize]: [number, number]} = {
      [TreeSize.small]: [2, 3],
      [TreeSize.large]: [4, 5]
   };

   private static readonly TREE_RADIUSES: Record<TreeSize, number> = {
      [TreeSize.small]: 40,
      [TreeSize.large]: 50
   };

   private readonly size: TreeSize;
   
   constructor(position: Point, isNaturallySpawned: boolean) {
      const size = randInt(0, 2) >= 1 ? 1 : 0;

      super(position, {
         health: new HealthComponent(Tree.MAX_HEALTH, false),
         item_creation: new ItemCreationComponent()
      }, "tree", isNaturallySpawned);


      const hitbox = new CircularHitbox();
      hitbox.setHitboxInfo(Tree.TREE_RADIUSES[size]);
      this.addHitbox(hitbox);

      this.isStatic = true;

      this.getComponent("item_creation")!.createItemOnDeath(ItemType.wood, randInt(...Tree.WOOD_DROP_AMOUNT_RECORD[size]), true);
      
      this.rotation = Math.PI * 2 * Math.random();

      this.size = size;

      if (size === TreeSize.small) {
         this.mass = 1.25;
      } else {
         this.mass = 1.5;
      }

      this.createEvent("hurt", (): void => {
         this.createLeafParticle("outerLeaf");
         for (let i = 0; i < 3; i++) {
            this.createLeafSpeckParticle("outerLeaf");
         }
      });

      this.createEvent("death", (): void => {
         let numLeaves: number;
         if (this.size === TreeSize.small) {
            numLeaves = randInt(2, 3);
         } else {
            numLeaves = randInt(4, 5);
         }
         for (let i = 0; i < numLeaves; i++) {
            this.createLeafParticle("innerLeaf");
            this.createLeafSpeckParticle("innerLeaf");
         }
      });
   }

   private createLeafParticle(type: "outerLeaf" | "innerLeaf"): void {
      const spawnPosition = this.position.copy();

      if (type === "outerLeaf") {
         const offset = new Vector(Tree.TREE_RADIUSES[this.size], 2 * Math.PI * Math.random()).convertToPoint();
         spawnPosition.add(offset);
      } else {
         const offset = new Vector(Tree.TREE_RADIUSES[this.size] * Math.random(), 2 * Math.PI * Math.random()).convertToPoint();
         spawnPosition.add(offset);
      }

      const lifetime = randFloat(2, 2.5);
      
      new Particle({
         type: ParticleType.leaf,
         spawnPosition: spawnPosition,
         initialVelocity: new Vector(randFloat(30, 50), 2 * Math.PI * Math.random()),
         initialAcceleration: null,
         drag: 75,
         initialRotation: 2 * Math.PI * Math.random(),
         angularVelocity: Math.PI * randFloat(-1, 1),
         angularDrag: 1.5 * Math.PI,
         opacity: (age: number): number => {
            return Math.pow(1 - age / lifetime, 0.5);
         },
         lifetime: lifetime
      });
   }

   private createLeafSpeckParticle(type: "outerLeaf" | "innerLeaf"): void {
      const spawnPosition = this.position.copy();

      if (type === "outerLeaf") {
         const offset = new Vector(Tree.TREE_RADIUSES[this.size], 2 * Math.PI * Math.random()).convertToPoint();
         spawnPosition.add(offset);
      } else {
         const offset = new Vector(Tree.TREE_RADIUSES[this.size] * Math.random(), 2 * Math.PI * Math.random()).convertToPoint();
         spawnPosition.add(offset);
      }

      const lifetime = randFloat(0.3, 0.5);
      
      new Particle({
         type: ParticleType.white1x1,
         spawnPosition: spawnPosition,
         initialVelocity: new Vector(randFloat(60, 80), 2 * Math.PI * Math.random()),
         initialAcceleration: null,
         drag: 30,
         initialRotation: 2 * Math.PI * Math.random(),
         opacity: (age: number): number => {
            return Math.pow(1 - age / lifetime, 0.3);
         },
         lifetime: lifetime,
         tint: [-1, randFloat(-0.3, -0.15), -1],
         scale: 1.5
      });
   }

   public getClientArgs(): [treeSize: TreeSize] {
      return [this.size];
   }
}

export default Tree;