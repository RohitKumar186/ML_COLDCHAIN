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

    X = df[FEATURES]

    y = df["cooling_level"].astype(int)

    # Chronological split
    split = int(len(df) * 0.8)

    X_train = X.iloc[:split]
    X_test = X.iloc[split:]

    y_train = y.iloc[:split]
    y_test = y.iloc[split:]

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

    model.fit(
        X_train,
        y_train
    )

    predictions = model.predict(
        X_test
    )

    accuracy = accuracy_score(
        y_test,
        predictions
    )

    print("\nCooling Model")
    print("====================")
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

    os.makedirs(
        os.path.dirname(COOLING_MODEL_PATH),
        exist_ok=True
    )

    joblib.dump(
        model,
        COOLING_MODEL_PATH
    )

    print(
        f"Model saved: {COOLING_MODEL_PATH}"
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

    return int(prediction[0])