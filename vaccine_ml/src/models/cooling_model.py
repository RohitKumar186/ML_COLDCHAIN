import os
import joblib
import pandas as pd

from xgboost import XGBClassifier

from sklearn.metrics import (
    accuracy_score,
    classification_report
)

from src.config import (
    COOLING_MODEL_PATH,
    PROCESSED_DATA_PATH
)


FEATURES = [
    "inside_temp",
    "outside_temp",

    "inside_lag_1",
    "inside_lag_2",
    "inside_lag_5",
    "inside_lag_10",

    "outside_lag_1",
    "outside_lag_5",

    "inside_change_1",
    "inside_change_5",

    "outside_change_1",
    "outside_change_5",

    "hour",
    "minute"
]


def train_cooling_model():

    df = pd.read_csv(
        PROCESSED_DATA_PATH
    )

    # =====================================================
    # REQUIRED DATA
    # =====================================================

    required = FEATURES + [
        "cooling_level"
    ]

    missing = [
        column
        for column in required
        if column not in df.columns
    ]

    if missing:

        raise ValueError(
            f"Missing cooling model columns: {missing}"
        )


    df = df.dropna(
        subset=required
    ).copy()


    if df.empty:

        raise ValueError(
            "No valid cooling training data."
        )


    # =====================================================
    # CHECK COOLING CLASSES
    # =====================================================

    classes = sorted(
        df["cooling_level"]
        .astype(int)
        .unique()
        .tolist()
    )


    print(
        f"[COOLING MODEL] Classes found: {classes}"
    )


    # =====================================================
    # ONE CLASS = CANNOT TRAIN CLASSIFIER
    #
    # Example:
    # [1]
    #
    # XGBoost requires at least two classes.
    # =====================================================

    if len(classes) < 2:

        raise ValueError(
            "Cooling model requires at least "
            "2 different cooling levels. "
            f"Currently found: {classes}"
        )


    # =====================================================
    # FEATURES / TARGET
    # =====================================================

    X = df[FEATURES]

    y = (
        df["cooling_level"]
        .astype(int)
    )


    # =====================================================
    # CHRONOLOGICAL SPLIT
    # =====================================================

    split = int(
        len(df) * 0.8
    )


    if split <= 0 or split >= len(df):

        raise ValueError(
            "Not enough data for train/test split."
        )


    X_train = X.iloc[:split]
    X_test = X.iloc[split:]

    y_train = y.iloc[:split]
    y_test = y.iloc[split:]


    # =====================================================
    # CHECK TRAINING CLASSES
    #
    # Important because chronological split can produce:
    #
    # train = [1]
    # test  = [1, 2]
    #
    # which cannot train correctly.
    # =====================================================

    train_classes = sorted(
        y_train.unique().tolist()
    )


    print(
        f"[COOLING MODEL] Training classes: "
        f"{train_classes}"
    )


    if len(train_classes) < 2:

        raise ValueError(
            "Cooling training split contains "
            "only one class: "
            f"{train_classes}. "
            "Need at least two cooling levels."
        )


    # =====================================================
    # MODEL
    # =====================================================

    model = XGBClassifier(

        n_estimators=300,

        learning_rate=0.05,

        max_depth=5,

        subsample=0.8,

        colsample_bytree=0.8,

        objective="multi:softmax",

        num_class=3,

        eval_metric="mlogloss",

        random_state=42
    )


    # =====================================================
    # TRAIN
    # =====================================================

    model.fit(
        X_train,
        y_train
    )


    # =====================================================
    # TEST
    # =====================================================

    predictions = model.predict(
        X_test
    )


    accuracy = accuracy_score(
        y_test,
        predictions
    )


    print()
    print(
        "Cooling Model"
    )
    print(
        "===================="
    )

    print(
        f"Accuracy: {accuracy:.3f}"
    )


    print(
        classification_report(
            y_test,
            predictions,
            zero_division=0
        )
    )


    # =====================================================
    # SAVE
    # =====================================================

    model_directory = os.path.dirname(
        COOLING_MODEL_PATH
    )


    if model_directory:

        os.makedirs(
            model_directory,
            exist_ok=True
        )


    joblib.dump(
        model,
        COOLING_MODEL_PATH
    )


    print(
        f"Model saved: "
        f"{COOLING_MODEL_PATH}"
    )


    return model


def load_cooling_model():

    return joblib.load(
        COOLING_MODEL_PATH
    )


def predict_cooling_level(
    model,
    feature_data
):

    prediction = model.predict(
        feature_data
    )

    return int(
        prediction[0]
    )