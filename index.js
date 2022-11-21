console.clear();

let shapes = null;
let lights = null;

let skyColor = null;

//source: https://cssdeck.com/labs/inkatza6
  class Canvas {
    // This class creates a canvas for drawing an image, one pixel at a time. Use it like this:
    //   let canvas = new Canvas(400, 300);
    // will create a new canvas that is 400 pixels by 300 pixels.
    //   canvas.setPixel(x, y, r, g, b, a);
    // sets the pixel at (x,y) to the color (r,g,b,a).
    //   canvas.setPixels();
    // updates the canvas to show the new pixels. You could call setPixels() after each setPixel()
    // call, but it will be much slower than updating a bunch of pixels with multiple setPixel()
    // calls and then calling setPixels() once.
    constructor(w, h) {
      [this.w, this.h] = [w, h];
      this.canvas = document.createElement("canvas");
      $(this.canvas).attr({width: this.w, height: this.h});
      $('body').append(this.canvas);
      this.ctx = this.canvas.getContext('2d');
      this.imageData = this.ctx.getImageData(0, 0, this.w, this.h);
      this.data = this.imageData.data;
    }
    setPixel(x, y, r, g, b, a) {
      let index = 4 * (y * this.w + x);
      //console.log(`${r} ${g} ${b}`);
      [this.data[index + 0], this.data[index + 1], this.data[index + 2], this.data[index + 3]] = [r, g, b, a];
    }
    setPixels() {
      this.ctx.putImageData(this.imageData, 0, 0);
    }
  }
//end copied code


class Vector3 {
  constructor(x, y, z) {
      this.x = x;
      this.y = y;
      this.z = z;
  }
  
  sub(vector3) {
      return new Vector3(this.x - vector3.x, this.y - vector3.y, this.z - vector3.z);
  }
  
  add(vector3) {
      return new Vector3(this.x + vector3.x, this.y + vector3.y, this.z + vector3.z);
  }
  
  multiply(scale) {
      return new Vector3(this.x * scale, this.y * scale, this.z * scale);
  }
  
  dot(vector3) {
      return (this.x * vector3.x + this.y * vector3.y + this.z * vector3.z);
  }
  
  lengthSquared() {
      return this.x * this.x + this.y * this.y + this.z * this.z;
  }
  
  length() {
      return Math.sqrt(this.lengthSquared());
  }
  
  normalize() {
      return this.multiply(1/this.length());
  }
  
  toArray() {
      return [this.x, this.y, this.z];
  }
}

class ColorRGB extends Vector3 {}

class Light {
    constructor(position, intensity) {
        this.position = position;
        //intensity goes from 0 to 1
        this.intensity = intensity;
    }
    
}

function getClosestShape(shapes, viewPosition, viewDirection) {
    let minT = Infinity;
    let closestShape = null;
    for (let shape of shapes) {
        let t = shape.rayTrace(viewPosition, viewDirection);
        if (t < minT && t >= 0) {
            minT = t;
            closestShape = shape;
        }
    }
    return [closestShape, minT];
}

function getClosestShapeExcept(shapes, exceptShape, viewPosition, viewDirection) {
    let minT = Infinity;
    let closestShape = null;
    for (let shape of shapes) {
        if (shape !== exceptShape) {
            let t = shape.rayTrace(viewPosition, viewDirection);
            if (t < minT && t >= 0 && t !== Infinity) {
                minT = t;
                closestShape = shape;
            }
        }
    }
    return [closestShape, minT];
}

function getClosestShadowCasterExcept(shapes, exceptShape, viewPosition, viewDirection) {
    let minT = Infinity;
    let closestShape = null;
    for (let shape of shapes) {
        if (shape !== exceptShape && shape.shape3dOptions.castShadows) {
            let t = shape.rayTrace(viewPosition, viewDirection);
            if (t < minT && t >= 0 && t !== Infinity) {
                minT = t;
                closestShape = shape;
            }
        }
    }
    return [closestShape, minT];
}

class Shape {
    constructor(color, position) {
        this.color = color;
        this.position = position;
    }
    
}

class Shape2d extends Shape {
    isInside() {}
    
    getColor(position) {
        if (this.isInside(position)) {
            return this.color;
        }
        return null;
    }
    
}

class Shape3dOptions {
    constructor(receiveShadows, castShadows, reflective) {
        this.receiveShadows = receiveShadows;
        this.castShadows = castShadows;
        this.reflective = reflective;
    }
    
}

class Shape3d extends Shape {
    constructor(color, position, shape3dOptions) {
        super(color, position);
        this.shape3dOptions = shape3dOptions;
    }
    
    getNormalVector(position3d) {}
    
    rayTrace(viewPosition, viewDirection) {}
    
    calcShadow(intersect3dPos, light3dPos) {
        if (!this.shape3dOptions.receiveShadows) {
            return false;
        }
        let shapeTPair = getClosestShadowCasterExcept(shapes, this, intersect3dPos, light3dPos.sub(intersect3dPos).normalize());
        return (shapeTPair[0] !== null);
    }
    
    getColorInternal(viewPosition, viewDirection, intersectionDistance, recursiveCallTimes) {
        if (intersectionDistance !== Infinity && intersectionDistance >= 0) {
            let poi = viewPosition.add(viewDirection.multiply(intersectionDistance));
            let n = this.getNormalVector(poi);
            
            if (this.shape3dOptions.reflective) {
                if (recursiveCallTimes > 0) {
                    //prevent infinite mirror effect
                    //need to improve this
                    return new ColorRGB(0, 0, 0);
                }
                let dperp = n.multiply(viewDirection.dot(n));
                let dpar = viewDirection.sub(dperp);
                let direction = dperp.multiply(-1).add(dpar);
        
                let closestShapeTPair = getClosestShapeExcept(shapes, this, poi, direction);
                let shape = closestShapeTPair[0];
                //let t = closestShapeTPair[1];
                if (shape !== null) {
                    return shape.getColorInternal(poi, direction, closestShapeTPair[1], recursiveCallTimes+1);
                }
                
                return skyColor;
            }
            
            
            let netBrightness = 0;
            
            for (let light of lights) {
                let lightPos = light.position;
                if (!this.calcShadow(poi, lightPos)) {
                    let m = (lightPos.sub(poi)).normalize();
                    let brightness = n.dot(m) * light.intensity;
                    if (brightness > 0) {
                        netBrightness += brightness;
                    }
                }
            }
            
            if (netBrightness > 1) {
                netBrightness = 1;
            }
            
            return this.color.multiply(netBrightness);
        }
        return null;
    }
    
    getColor(viewPosition, viewDirection, intersectionDistance) {
        return this.getColorInternal(viewPosition, viewDirection, intersectionDistance, 0);
    }
    
}

class Sphere extends Shape3d {
    constructor(color, position, shape3dOptions, radius) {
        super(color, position, shape3dOptions);
        this.radius = radius;
    }
    
    getNormalVector(position3d) {
        return position3d.sub(this.position).normalize();
    }
    
    rayTrace(viewPosition, viewDirection) {
        /*
        o = sphere center pos
        r = radius (r)
        let viewPosition (Po) = [0, 0, 0];
        let viewDirection (v) = [x, y, -1].norm();
        
        */
        let a = /*v^2*/ 1;
        let b = /*2v*(Po-O) */ 2 * viewDirection.dot(viewPosition.sub(this.position));
        let c = /*(Po-O)^2 - r^2*/ (viewPosition.sub(this.position)).dot((viewPosition.sub(this.position))) - this.radius*this.radius;
        let discriminant = b*b-4*a*c;
        if (discriminant < 0) {
            return Infinity;
        }
        return (-1*b-Math.sqrt(discriminant))/(2*a);
    }
    
}

class Plane extends Shape3d {
    constructor(color, normalVector, shape3dOptions, d) {
        super(color, new Vector3(0, 0, 0), shape3dOptions);
        this.normalVector = normalVector.normalize();
        this.d = d;
    }
    
    getNormalVector(position3d) {
        return this.normalVector;
    }
    
    rayTrace(viewPosition, viewDirection) {
        return (this.d-(this.normalVector.dot(viewPosition)))/(this.normalVector.dot(viewDirection));
    }
    
}

class Circle extends Shape2d {
    constructor(color, position, radius) {
        super(color, position);
        this.radius = radius;
    }
    
    isInside(position) {
        return (this.radius > 0 && (this.position.sub(position)).lengthSquared() <= this.radius*this.radius);
    }
    
}

class Rectangle extends Shape2d {
    constructor(color, position, width, height) {
        super(color, position);
        this.width = width;
        this.height = height;
    }
    
    isInside(position) {
        let distanceVec = this.position.sub(position);
        return (Math.abs(distanceVec.x) <= this.width && Math.abs(distanceVec.y) <= this.height);
    }
    
}

let canvas = new Canvas(900, 900);

shapes = [
    new Sphere(new ColorRGB(0, 255, 255), new Vector3(-3, 1, -4), new Shape3dOptions(false, true, true), 1),
    new Sphere(new ColorRGB(0, 255, 255), new Vector3(3, 1, -4), new Shape3dOptions(false, true, false), 1),
    new Sphere(new ColorRGB(73, 126, 118), new Vector3(3, 1, 10), new Shape3dOptions(false, true, false), 2),
    //new Circle(new ColorRGB(0, 255, 255), new Vector3(0.5, 0, 0), 0.1),
    //new Rectangle(new ColorRGB(255, 0, 0), new Vector3(0, 0, 0), 0.65, 0.05),
    //new Rectangle(new ColorRGB(0, 255, 0), new Vector3(0, 0, 0), 0.1, 0.2),
    //new Rectangle(new ColorRGB(0, 0, 255), new Vector3(-0.4, -0.3, 0), 0.5, 0.02),
    new Plane(new ColorRGB(94, 147, 57), new Vector3(0, 1, 0), new Shape3dOptions(true, false, false), -2)];

lights = [
    new Light(new Vector3(1, 10, 3), 1),
    new Light(new Vector3(10, 10, 10), 0.40)
]
    
skyColor = new ColorRGB(33, 55, 139);
    
function toViewportCords(vector3) {
    let minLength = Math.min(canvas.w, canvas.h);
    return new Vector3(2*(vector3.x-(canvas.w-minLength)/2)/minLength-1, 1-2*(vector3.y-(canvas.h-minLength)/2)/minLength, 0);
}


for (let j = 0; j < canvas.h; j++) {
    for (let i = 0; i < canvas.w; i++) {
        let color = null;
        let viewPosition = new Vector3(0, 0, 0);
        let position = toViewportCords(new Vector3(i, j, 0));
        
        let viewDirection = (new Vector3(position.x, position.y, -1)).normalize();
        let closestShapeTPair = getClosestShape(shapes, viewPosition, viewDirection);
        if (closestShapeTPair[0] !== null) {
            color = closestShapeTPair[0].getColor(viewPosition, viewDirection, closestShapeTPair[1]);
        } else {
            color = skyColor;
        }
        
        canvas.setPixel(i, j, color.x, color.y, color.z, 255);
    }
}


canvas.setPixels();