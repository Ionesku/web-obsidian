# Machine Learning

## Overview
Machine learning is a subset of artificial intelligence that enables systems to learn and improve from experience.

## Key Concepts

### Supervised Learning
Training with labeled data to make predictions.

**Examples:**
- Image classification
- Spam detection
- Price prediction

### Unsupervised Learning
Finding patterns in unlabeled data.

**Examples:**
- Clustering
- Dimensionality reduction
- Anomaly detection

### Reinforcement Learning
Learning through trial and error with rewards.

**Examples:**
- Game playing (AlphaGo)
- Robotics
- Autonomous vehicles

## Popular Frameworks

```python
# TensorFlow Example
import tensorflow as tf

model = tf.keras.Sequential([
    tf.keras.layers.Dense(128, activation='relu'),
    tf.keras.layers.Dropout(0.2),
    tf.keras.layers.Dense(10, activation='softmax')
])

model.compile(
    optimizer='adam',
    loss='sparse_categorical_crossentropy',
    metrics=['accuracy']
)
```

## Resources
- [[Neural Networks]]
- [[Deep Learning]]
- [[Data Science Tools]]

## Papers to Read
- Attention Is All You Need (Transformers)
- ResNet: Deep Residual Learning
- BERT: Pre-training of Deep Bidirectional Transformers

---

Tags: #machine-learning #ai #research #deep-learning #neural-networks
Related: [[Computer Science]] | [[Mathematics]]

