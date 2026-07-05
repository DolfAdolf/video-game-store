import os
from datetime import date, datetime, timedelta

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
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
ACCESS_TOKEN_EXPIRE_MINUTES = 30

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

class GameBase(BaseModel):
    title: str
    description: str | None = None
    price: float
    cover_url: str | None = None
    release_date: str | None = None   # принимаем строку YYYY-MM-DD
    developer: str | None = None
    publisher: str | None = None
    genre_ids: list[int] = []

class GameCreate(GameBase):
    pass

class GameOut(BaseModel):
    id: int
    title: str
    description: str | None = None
    price: float
    cover_url: str | None = None
    release_date: date | None = None   # возвращаем как date (не строку)
    developer: str | None = None
    publisher: str | None = None
    genre_ids: list[int] = []
    created_at: datetime | None = None
    updated_at: datetime | None = None

    class Config:
        from_attributes = True

# ----- Эндпоинты -----
@app.get("/api/health")
def health():
    return {"status": "ok"}

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

@app.get("/api/games", response_model=list[GameOut])
def get_games(db: Session = Depends(get_db)):
    return db.query(models.Game).all()

@app.get("/api/games/{game_id}", response_model=GameOut)
def get_game(game_id: int, db: Session = Depends(get_db)):
    game = db.query(models.Game).filter(models.Game.id == game_id).first()
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    return game

@app.post("/api/games", status_code=status.HTTP_201_CREATED, response_model=GameOut)
def create_game(game: GameCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_admin_user)):
    new_game = models.Game(
        title=game.title,
        description=game.description,
        price=game.price,
        cover_url=game.cover_url,
        release_date=game.release_date,   # SQLAlchemy преобразует строку в date
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
    return new_game