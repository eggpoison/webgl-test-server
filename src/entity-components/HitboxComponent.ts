import Component from "./Component";

export type CircularHitbox = {
   readonly type: "circular";
   readonly radius: number;
}

export type RectangularHitbox = {
   readonly type: "rectangular";
   readonly width: number;
   readonly height: number;
}

export type Hitbox = CircularHitbox | RectangularHitbox;

class HitboxComponent extends Component {
   public readonly hitbox: Hitbox;

   constructor(hitbox: Hitbox) {
      super();

      this.hitbox = hitbox;
   }
}

export default HitboxComponent;