import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import {
  getGetAdminCustomersQueryKey,
  useGetAdminCustomers,
} from '@workspace/api-client-react';
import { EmptyState, F, ScreenHeader, useBottomPad } from '@/components/ui';
import { useColors } from '@/hooks/useColors';

function dateLabel(value: string | Date) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

export default function CustomerAdmin() {
  const c = useColors();
  const bottom = useBottomPad(false);
  const query = useGetAdminCustomers({
    query: { queryKey: getGetAdminCustomersQueryKey(), retry: false },
  });

  return (
    <View style={[styles.screen, { backgroundColor: c.background }]}>
      <ScreenHeader title="Customer admin" />
      {query.isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={c.primary} />
      ) : query.isError ? (
        <EmptyState
          icon="lock"
          title="Admin access required"
          body="This customer list is only available to the configured account owner."
        />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: bottom }}>
          <View style={styles.heading}>
            <Text style={[styles.count, { color: c.foreground }]}>{query.data?.customers.length ?? 0}</Text>
            <Text style={[styles.description, { color: c.mutedForeground }]}>
              customers with email and phone verification status
            </Text>
          </View>
          {(query.data?.customers ?? []).map((customer) => (
            <View
              key={customer.clerkUserId}
              testID={`admin-customer-${customer.clerkUserId}`}
              style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}
            >
              <View style={[styles.avatar, { backgroundColor: c.accent }]}>
                <Feather name="user" size={20} color={c.primary} />
              </View>
              <View style={styles.details}>
                <Text style={[styles.name, { color: c.foreground }]} numberOfLines={1}>
                  {[customer.firstName, customer.lastName].filter(Boolean).join(' ') || 'Customer'}
                </Text>
                <Text style={[styles.subtext, { color: c.mutedForeground }]} numberOfLines={1}>
                  {customer.phoneNumber ?? 'Phone not added'}
                </Text>
                <Text style={[styles.subtext, { color: c.mutedForeground }]} numberOfLines={1}>
                  {customer.email}
                </Text>
                <View style={styles.statusRow}>
                  <StatusPill label="Phone verified" verified={customer.phoneVerified} />
                  <StatusPill label="Email verified" verified={customer.emailVerified} />
                </View>
                <Text style={[styles.created, { color: c.mutedForeground }]}>
                  Joined {dateLabel(customer.createdAt)}
                </Text>
              </View>
            </View>
          ))}
          {!query.data?.customers.length ? (
            <EmptyState icon="users" title="No customers yet" body="Verified customer accounts will appear here." />
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

function StatusPill({ label, verified }: { label: string; verified: boolean }) {
  const c = useColors();
  return (
    <View style={[styles.status, { backgroundColor: verified ? '#153D2A' : c.elevated }]}>
      <Feather name={verified ? 'check-circle' : 'clock'} size={12} color={verified ? '#55D98A' : c.mutedForeground} />
      <Text style={{ fontFamily: F.m, fontSize: 11, color: verified ? '#8AF0B1' : c.mutedForeground }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  heading: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  count: { fontFamily: F.b, fontSize: 30 },
  description: { fontFamily: F.r, fontSize: 14, marginTop: 3 },
  card: { flexDirection: 'row', gap: 13, marginHorizontal: 16, marginBottom: 10, padding: 14, borderWidth: 1, borderRadius: 14 },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  details: { flex: 1, gap: 4 },
  name: { fontFamily: F.s, fontSize: 16 },
  subtext: { fontFamily: F.r, fontSize: 13 },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 7 },
  status: { flexDirection: 'row', gap: 5, alignItems: 'center', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 20 },
  created: { fontFamily: F.r, fontSize: 11, marginTop: 3 },
});
