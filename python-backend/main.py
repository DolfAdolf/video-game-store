import os
from datetime import date, datetime, timedelta

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from sqlalchemy import func as sa_func   # для агрегатных функций
from jose import JWTError, jwt
from pydantic import BaseModel

from database import SessionLocal, engine, Base
import models
from passlib.context import CryptContext

app = FastAPI()

models.Base.metadata.create_all(bind=engine)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

SECRET_KEY = os.getenv("JWT_SECRET")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440

# ----- Зависимости БД и безопасности -----
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/login")

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = db.query(models.User).filter(models.User.id == int(user_id)).first()
    if user is None:
        raise credentials_exception
    return user

def get_admin_user(current_user: models.User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return current_user

# ----- Pydantic схемы -----
class UserCreate(BaseModel):
    username: str | None = None
    email: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class GenreOut(BaseModel):
    id: int
    name: str
    slug: str

    class Config:
        from_attributes = True

class GameBase(BaseModel):
    title: str
    description: str | None = None
    price: float
    cover_url: str | None = None
    release_date: str | None = None
    developer: str | None = None
    publisher: str | None = None
    genre_ids: list[int] = []

class GameCreate(GameBase):
    pass

class GameUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    price: float | None = None
    cover_url: str | None = None
    release_date: str | None = None
    developer: str | None = None
    publisher: str | None = None
    genre_ids: list[int] | None = None

class GameOut(BaseModel):
    id: int
    title: str
    description: str | None = None
    price: float
    cover_url: str | None = None
    release_date: date | None = None
    developer: str | None = None
    publisher: str | None = None
    genre_ids: list[int] = []
    genres: list[GenreOut] = []
    created_at: datetime | None = None
    updated_at: datetime | None = None

    class Config:
        from_attributes = True

# Новая схема для списка игр с рейтингом
class GameOutSimple(BaseModel):
    id: int
    title: str
    description: str | None = None
    price: float
    cover_url: str | None = None
    release_date: date | None = None
    developer: str | None = None
    publisher: str | None = None
    genre_ids: list[int] = []
    avg_rating: float | None = None      # <-- средний рейтинг
    review_count: int = 0                # <-- количество отзывов
    created_at: datetime | None = None
    updated_at: datetime | None = None

    class Config:
        from_attributes = True

class ReviewCreate(BaseModel):
    rating: int = 5
    text: str | None = None

class ReviewOut(BaseModel):
    id: int
    game_id: int
    user_id: int
    username: str | None = None
    rating: int
    text: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True

# Схемы для корзины
class CartItemCreate(BaseModel):
    game_id: int
    quantity: int = 1

class CartItemUpdate(BaseModel):
    quantity: int

class CartItemOut(BaseModel):
    id: int
    game_id: int
    title: str | None = None
    price: float | None = None
    cover_url: str | None = None
    quantity: int

    class Config:
        from_attributes = True

# ----- Эндпоинты -----
@app.get("/api/health")
def health():
    return {"status": "ok"}

@app.get("/api/genres", response_model=list[GenreOut])
def get_genres(db: Session = Depends(get_db)):
    return db.query(models.Genre).all()

@app.post("/api/register", status_code=status.HTTP_201_CREATED)
def register(user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    hashed_password = pwd_context.hash(user.password)
    new_user = models.User(
        username=user.username,
        email=user.email,
        password_hash=hashed_password
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"message": "User created", "user_id": new_user.id}

@app.post("/api/login", response_model=Token)
def login(user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if not db_user:
        raise HTTPException(status_code=400, detail="Invalid credentials")
    if not pwd_context.verify(user.password, db_user.password_hash):
        raise HTTPException(status_code=400, detail="Invalid credentials")
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode = {"sub": str(db_user.id), "role": db_user.role, "exp": expire}
    access_token = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return {"access_token": access_token}

# Список игр с рейтингом
@app.get("/api/games", response_model=list[GameOutSimple])
def get_games(db: Session = Depends(get_db)):
    games = db.query(models.Game).all()
    result = []
    for game in games:
        # собираем жанры
        gg_items = db.query(models.GameGenre).filter(models.GameGenre.game_id == game.id).all()
        genre_ids = [gg.genre_id for gg in gg_items]
        # вычисляем средний рейтинг и количество отзывов
        avg_rating = db.query(sa_func.avg(models.Review.rating)).filter(models.Review.game_id == game.id).scalar()
        review_count = db.query(sa_func.count(models.Review.id)).filter(models.Review.game_id == game.id).scalar()
        result.append({
            **game.__dict__,
            "genre_ids": genre_ids,
            "avg_rating": round(float(avg_rating), 1) if avg_rating else None,
            "review_count": review_count or 0
        })
    return result

@app.get("/api/games/{game_id}", response_model=GameOut)
def get_game(game_id: int, db: Session = Depends(get_db)):
    game = db.query(models.Game).filter(models.Game.id == game_id).first()
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    gg_items = db.query(models.GameGenre).filter(models.GameGenre.game_id == game_id).all()
    genre_ids = [gg.genre_id for gg in gg_items]
    genres = db.query(models.Genre).filter(models.Genre.id.in_(genre_ids)).all() if genre_ids else []

    return {
        "id": game.id,
        "title": game.title,
        "description": game.description,
        "price": game.price,
        "cover_url": game.cover_url,
        "release_date": game.release_date,
        "developer": game.developer,
        "publisher": game.publisher,
        "genre_ids": genre_ids,
        "genres": [{"id": g.id, "name": g.name, "slug": g.slug} for g in genres],
        "created_at": game.created_at,
        "updated_at": game.updated_at
    }

@app.post("/api/games", status_code=status.HTTP_201_CREATED, response_model=GameOut)
def create_game(game: GameCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_admin_user)):
    new_game = models.Game(
        title=game.title,
        description=game.description,
        price=game.price,
        cover_url=game.cover_url,
        release_date=game.release_date,
        developer=game.developer,
        publisher=game.publisher,
    )
    db.add(new_game)
    db.flush()
    for genre_id in game.genre_ids:
        genre = db.query(models.Genre).filter(models.Genre.id == genre_id).first()
        if genre:
            db.add(models.GameGenre(game_id=new_game.id, genre_id=genre_id))
    db.commit()
    db.refresh(new_game)
    gg_items = db.query(models.GameGenre).filter(models.GameGenre.game_id == new_game.id).all()
    genre_ids = [gg.genre_id for gg in gg_items]
    genres = db.query(models.Genre).filter(models.Genre.id.in_(genre_ids)).all() if genre_ids else []
    return {
        "id": new_game.id,
        "title": new_game.title,
        "description": new_game.description,
        "price": new_game.price,
        "cover_url": new_game.cover_url,
        "release_date": new_game.release_date,
        "developer": new_game.developer,
        "publisher": new_game.publisher,
        "genre_ids": genre_ids,
        "genres": [{"id": g.id, "name": g.name, "slug": g.slug} for g in genres],
        "created_at": new_game.created_at,
        "updated_at": new_game.updated_at
    }

@app.put("/api/games/{game_id}", response_model=GameOut)
def update_game(game_id: int, game: GameUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(get_admin_user)):
    db_game = db.query(models.Game).filter(models.Game.id == game_id).first()
    if not db_game:
        raise HTTPException(status_code=404, detail="Game not found")

    update_data = game.model_dump(exclude_unset=True)
    genre_ids = update_data.pop("genre_ids", None)

    for key, value in update_data.items():
        setattr(db_game, key, value)

    if genre_ids is not None:
        db.query(models.GameGenre).filter(models.GameGenre.game_id == game_id).delete()
        for gid in genre_ids:
            genre = db.query(models.Genre).filter(models.Genre.id == gid).first()
            if genre:
                db.add(models.GameGenre(game_id=game_id, genre_id=gid))

    db.commit()
    db.refresh(db_game)

    gg_items = db.query(models.GameGenre).filter(models.GameGenre.game_id == game_id).all()
    genre_ids_resp = [gg.genre_id for gg in gg_items]
    genres = db.query(models.Genre).filter(models.Genre.id.in_(genre_ids_resp)).all() if genre_ids_resp else []
    return {
        "id": db_game.id,
        "title": db_game.title,
        "description": db_game.description,
        "price": db_game.price,
        "cover_url": db_game.cover_url,
        "release_date": db_game.release_date,
        "developer": db_game.developer,
        "publisher": db_game.publisher,
        "genre_ids": genre_ids_resp,
        "genres": [{"id": g.id, "name": g.name, "slug": g.slug} for g in genres],
        "created_at": db_game.created_at,
        "updated_at": db_game.updated_at
    }

@app.delete("/api/games/{game_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_game(game_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_admin_user)):
    db_game = db.query(models.Game).filter(models.Game.id == game_id).first()
    if not db_game:
        raise HTTPException(status_code=404, detail="Game not found")
    db.query(models.GameGenre).filter(models.GameGenre.game_id == game_id).delete()
    db.delete(db_game)
    db.commit()
    return None

# ----- Отзывы -----
@app.post("/api/games/{game_id}/reviews", status_code=status.HTTP_201_CREATED, response_model=ReviewOut)
def create_review(game_id: int, review: ReviewCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    game = db.query(models.Game).filter(models.Game.id == game_id).first()
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    existing = db.query(models.Review).filter(
        models.Review.game_id == game_id,
        models.Review.user_id == current_user.id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="You have already reviewed this game")

    new_review = models.Review(
        game_id=game_id,
        user_id=current_user.id,
        rating=review.rating,
        text=review.text
    )
    db.add(new_review)
    db.commit()
    db.refresh(new_review)

    return {
        "id": new_review.id,
        "game_id": new_review.game_id,
        "user_id": new_review.user_id,
        "username": current_user.username or current_user.email,
        "rating": new_review.rating,
        "text": new_review.text,
        "created_at": new_review.created_at
    }

@app.get("/api/games/{game_id}/reviews", response_model=list[ReviewOut])
def get_reviews(game_id: int, db: Session = Depends(get_db)):
    game = db.query(models.Game).filter(models.Game.id == game_id).first()
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    reviews = db.query(models.Review).filter(models.Review.game_id == game_id).order_by(models.Review.created_at.desc()).all()
    result = []
    for r in reviews:
        user = db.query(models.User).filter(models.User.id == r.user_id).first()
        username = user.username or user.email if user else "Unknown"
        result.append({
            "id": r.id,
            "game_id": r.game_id,
            "user_id": r.user_id,
            "username": username,
            "rating": r.rating,
            "text": r.text,
            "created_at": r.created_at
        })
    return result

# ----- Корзина -----
@app.get("/api/cart", response_model=list[CartItemOut])
def get_cart(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    items = db.query(models.CartItem).filter(models.CartItem.user_id == current_user.id).all()
    result = []
    for item in items:
        game = db.query(models.Game).filter(models.Game.id == item.game_id).first()
        result.append({
            "id": item.id,
            "game_id": item.game_id,
            "title": game.title if game else "Unknown",
            "price": float(game.price) if game else 0,
            "cover_url": game.cover_url if game else None,
            "quantity": item.quantity
        })
    return result

@app.post("/api/cart/items", status_code=status.HTTP_201_CREATED, response_model=CartItemOut)
def add_to_cart(item: CartItemCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    game = db.query(models.Game).filter(models.Game.id == item.game_id).first()
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    existing = db.query(models.CartItem).filter(
        models.CartItem.user_id == current_user.id,
        models.CartItem.game_id == item.game_id
    ).first()
    if existing:
        existing.quantity += item.quantity
        db.commit()
        db.refresh(existing)
        return {
            "id": existing.id,
            "game_id": existing.game_id,
            "title": game.title,
            "price": float(game.price),
            "cover_url": game.cover_url,
            "quantity": existing.quantity
        }

    new_item = models.CartItem(
        user_id=current_user.id,
        game_id=item.game_id,
        quantity=item.quantity
    )
    db.add(new_item)
    db.commit()
    db.refresh(new_item)
    return {
        "id": new_item.id,
        "game_id": new_item.game_id,
        "title": game.title,
        "price": float(game.price),
        "cover_url": game.cover_url,
        "quantity": new_item.quantity
    }

@app.put("/api/cart/items/{item_id}", response_model=CartItemOut)
def update_cart_item(item_id: int, update: CartItemUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    cart_item = db.query(models.CartItem).filter(
        models.CartItem.id == item_id,
        models.CartItem.user_id == current_user.id
    ).first()
    if not cart_item:
        raise HTTPException(status_code=404, detail="Cart item not found")

    if update.quantity <= 0:
        db.delete(cart_item)
        db.commit()
        raise HTTPException(status_code=204, detail="Item removed")

    cart_item.quantity = update.quantity
    db.commit()
    db.refresh(cart_item)
    game = db.query(models.Game).filter(models.Game.id == cart_item.game_id).first()
    return {
        "id": cart_item.id,
        "game_id": cart_item.game_id,
        "title": game.title if game else "Unknown",
        "price": float(game.price) if game else 0,
        "cover_url": game.cover_url if game else None,
        "quantity": cart_item.quantity
    }

@app.delete("/api/cart/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_cart_item(item_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    cart_item = db.query(models.CartItem).filter(
        models.CartItem.id == item_id,
        models.CartItem.user_id == current_user.id
    ).first()
    if not cart_item:
        raise HTTPException(status_code=404, detail="Cart item not found")
    db.delete(cart_item)
    db.commit()
    return None