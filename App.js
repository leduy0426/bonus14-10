import { StatusBar } from 'expo-status-bar';
import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
} from 'react-native';
import * as SQLite from 'expo-sqlite';

// ─── DATABASE HELPERS ───────────────────────────────────────────────────────

// Open (or create) the SQLite database
async function loadDB() {
  const db = await SQLite.openDatabaseAsync('notes.db');
  // Enable WAL mode for better concurrent performance
  await db.execAsync('PRAGMA journal_mode = WAL;');
  // Create the Notes table if it doesn't exist
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS Notes (
      id      INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL
    );
  `);
  return db;
}

// Fetch all notes from the database (newest first)
async function fetchNotes(db) {
  return await db.getAllAsync('SELECT * FROM Notes ORDER BY id DESC;');
}

// Insert a new note into the database
async function addNote(db, content) {
  await db.runAsync('INSERT INTO Notes (content) VALUES (?);', [content]);
}

// Delete a note by id
async function deleteNote(db, id) {
  await db.runAsync('DELETE FROM Notes WHERE id = ?;', [id]);
}

// ─── APP COMPONENT ──────────────────────────────────────────────────────────

export default function App() {
  const [db, setDb] = useState(null);           // SQLite database reference
  const [note, setNote] = useState('');         // current TextInput value
  const [notes, setNotes] = useState([]);       // list of notes displayed

  // On mount: open the DB and load existing notes
  useEffect(() => {
    (async () => {
      const database = await loadDB();
      setDb(database);
      const rows = await fetchNotes(database);
      setNotes(rows);
    })();
  }, []);

  // Re-fetch notes whenever the `note` state changes (after add/delete)
  useEffect(() => {
    if (db) {
      fetchNotes(db).then(setNotes);
    }
  }, [note, db]);

  // Handle adding a new note
  const handleAddNote = async () => {
    const trimmed = note.trim();
    if (!trimmed) {
      Alert.alert('Empty Note', 'Please type something before adding a note.');
      return;
    }
    await addNote(db, trimmed);
    setNote('');                       // clear the input
    const rows = await fetchNotes(db); // refresh list
    setNotes(rows);
  };

  // Handle deleting a note with confirmation
  const handleDeleteNote = (id) => {
    Alert.alert(
      'Delete Note',
      'Are you sure you want to delete this note?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteNote(db, id);
            const rows = await fetchNotes(db);
            setNotes(rows);
          },
        },
      ]
    );
  };

  // Render each note item in the FlatList
  const renderItem = ({ item, index }) => (
    <View style={styles.noteCard}>
      <View style={styles.noteMeta}>
        <View style={styles.noteIndexBadge}>
          <Text style={styles.noteIndexText}>#{notes.length - index}</Text>
        </View>
        <Text style={styles.noteContent} numberOfLines={4}>
          {item.content}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleDeleteNote(item.id)}
        accessibilityLabel="Delete note"
      >
        <Text style={styles.deleteButtonText}>✕</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />

      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📝 Reminder Notes</Text>
        <Text style={styles.headerSubtitle}>SQLite-powered local storage</Text>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* ── Input Area ── */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            placeholder="Type a reminder note…"
            placeholderTextColor="#94a3b8"
            value={note}
            onChangeText={setNote}
            multiline
            maxLength={300}
          />
          <TouchableOpacity
            style={[styles.addButton, !note.trim() && styles.addButtonDisabled]}
            onPress={handleAddNote}
            disabled={!note.trim()}
          >
            <Text style={styles.addButtonText}>+ Add Note</Text>
          </TouchableOpacity>
        </View>

        {/* ── Notes Count ── */}
        <View style={styles.countRow}>
          <Text style={styles.countText}>
            {notes.length === 0
              ? 'No notes yet'
              : `${notes.length} note${notes.length > 1 ? 's' : ''} stored`}
          </Text>
        </View>

        {/* ── Notes List ── */}
        {notes.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🗒️</Text>
            <Text style={styles.emptyTitle}>Your notes will appear here</Text>
            <Text style={styles.emptySubtitle}>
              Add your first reminder above and it will be saved locally with SQLite.
            </Text>
          </View>
        ) : (
          <FlatList
            data={notes}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────────────

const COLORS = {
  bg: '#0f172a',          // dark navy background
  surface: '#1e293b',     // card surface
  surfaceAlt: '#334155',  // slightly lighter surface
  accent: '#6366f1',      // indigo accent
  accentLight: '#818cf8',
  danger: '#ef4444',
  text: '#f1f5f9',
  textMuted: '#94a3b8',
  border: '#334155',
};

const styles = StyleSheet.create({
  flex: { flex: 1 },

  safeArea: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },

  // Header
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: COLORS.bg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 2,
  },

  // Input
  inputContainer: {
    margin: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  textInput: {
    minHeight: 90,
    maxHeight: 150,
    padding: 16,
    fontSize: 16,
    color: COLORS.text,
    textAlignVertical: 'top',
    lineHeight: 22,
  },
  addButton: {
    backgroundColor: COLORS.accent,
    marginHorizontal: 12,
    marginBottom: 12,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  addButtonDisabled: {
    backgroundColor: COLORS.surfaceAlt,
    opacity: 0.6,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.4,
  },

  // Count row
  countRow: {
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  countText: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingBottom: 60,
  },
  emptyIcon: {
    fontSize: 56,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },

  // List
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },

  // Note card
  noteCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  noteMeta: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    gap: 10,
  },
  noteIndexBadge: {
    backgroundColor: COLORS.accent,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    minWidth: 32,
    alignItems: 'center',
    marginTop: 1,
  },
  noteIndexText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  noteContent: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text,
    lineHeight: 22,
  },
  deleteButton: {
    backgroundColor: COLORS.danger,
    width: 44,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
});
