import React, {useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Switch,
  ScrollView,
  Alert,
  Linking,
} from 'react-native';
import {C} from '../constants/colors';
import {Storage} from '../storage/Storage';
import {PairingService} from '../services/PairingService';
import {LogsService} from '../services/LogsService';
import {RuntimeConfigService} from '../services/RuntimeConfigService';
import AppHeader from '../components/AppHeader';

export default function SettingsScreen({navigation}) {
  const [settings, setSettings] = useState(Storage.getSettings());
  const rePairRequired = Storage.getRePairRequired();
  const supportEmail = RuntimeConfigService.getSupportEmail();
  const privacyPolicyUrl = RuntimeConfigService.getPrivacyPolicyUrl();
  const releaseConfigErrors = RuntimeConfigService.getReleaseConfigErrors();

  const toggle = key => {
    const next = {...settings, [key]: !settings[key]};
    setSettings(next);
    Storage.saveSettings(next);
    LogsService.add(
      'settings',
      'Setting Changed',
      `${key}=${next[key]}`,
      'SET',
    );
  };

  const openSupport = async () => {
    if (!supportEmail) {
      Alert.alert(
        'Support Unavailable',
        'Support email is not configured in this build.',
      );
      return;
    }

    const supportUrl = `mailto:${supportEmail}?subject=MotoLink%20Support`;
    const canOpen = await Linking.canOpenURL(supportUrl);
    if (!canOpen) {
      Alert.alert(
        'Email Unavailable',
        "MotoLink couldn't open your email app.",
      );
      return;
    }

    await Linking.openURL(supportUrl);
  };

  const openPrivacyPolicy = async () => {
    if (!privacyPolicyUrl) {
      Alert.alert(
        'Privacy Policy Unavailable',
        'Privacy policy URL is not configured in this build.',
      );
      return;
    }

    const canOpen = await Linking.canOpenURL(privacyPolicyUrl);
    if (!canOpen) {
      Alert.alert(
        'Privacy Policy Unavailable',
        "MotoLink couldn't open the privacy policy URL.",
      );
      return;
    }

    await Linking.openURL(privacyPolicyUrl);
  };

  return (
    <View style={styles.root}>
      <AppHeader
        title="Settings"
        leftLabel="Back"
        rightLabel="Home"
        onLeftPress={() =>
          navigation.canGoBack()
            ? navigation.goBack()
            : navigation.navigate('Home')
        }
        onRightPress={() => navigation.navigate('Home')}
      />
      <ScrollView contentContainerStyle={styles.content}>
        {rePairRequired ? (
          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>Re-pair required</Text>
            <Text style={styles.noticeText}>
              This device needs to be paired again before MotoLink can continue
              securely.
            </Text>
            <TouchableOpacity
              style={styles.noticeBtn}
              onPress={() => {
                PairingService.forgetDevice();
                Storage.clearRePairRequired();
                navigation.reset({
                  index: 0,
                  routes: [{name: 'Scan'}],
                });
              }}>
              <Text style={styles.noticeBtnText}>Re-pair Now</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {Object.keys(settings).map(key => (
          <View key={key} style={styles.row}>
            <Text style={styles.key}>{key}</Text>
            <Switch value={!!settings[key]} onValueChange={() => toggle(key)} />
          </View>
        ))}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support & Privacy</Text>
          <TouchableOpacity
            style={[styles.linkBtn, !supportEmail && styles.linkBtnDisabled]}
            disabled={!supportEmail}
            onPress={() => openSupport().catch(() => null)}>
            <Text style={styles.linkText}>Email Support</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.linkBtn,
              !privacyPolicyUrl && styles.linkBtnDisabled,
            ]}
            disabled={!privacyPolicyUrl}
            onPress={() => openPrivacyPolicy().catch(() => null)}>
            <Text style={styles.linkText}>Privacy Policy</Text>
          </TouchableOpacity>
          <Text style={styles.metaText}>
            {supportEmail
              ? `Support: ${supportEmail}`
              : 'Support email not configured.'}
          </Text>
          <Text style={styles.metaText}>
            {privacyPolicyUrl
              ? `Privacy: ${privacyPolicyUrl}`
              : 'Privacy policy URL not configured.'}
          </Text>
          {releaseConfigErrors.length > 0 ? (
            <View style={styles.releaseWarning}>
              <Text style={styles.releaseWarningTitle}>
                Release config issues
              </Text>
              {releaseConfigErrors.map(error => (
                <Text key={error} style={styles.releaseWarningText}>
                  {`\u2022 ${error}`}
                </Text>
              ))}
            </View>
          ) : null}
        </View>

        <TouchableOpacity
          style={styles.forget}
          onPress={() => {
            PairingService.forgetDevice();
            navigation.navigate('Scan');
          }}>
          <Text style={styles.forgetTxt}>Forget Paired Device</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: C.bg},
  content: {padding: 16, gap: 10},
  notice: {
    borderWidth: 1,
    borderColor: C.warning || '#AA7A2A',
    borderRadius: 12,
    backgroundColor: '#FFF7E8',
    padding: 12,
    gap: 8,
  },
  noticeTitle: {color: C.dark, fontWeight: '800', fontSize: 14},
  noticeText: {color: C.textSub, lineHeight: 18},
  noticeBtn: {
    alignSelf: 'flex-start',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: C.primary,
  },
  noticeBtnText: {color: C.dark, fontWeight: '800'},
  row: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    backgroundColor: C.surface,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  key: {color: C.text, fontWeight: '700'},
  section: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    backgroundColor: C.surface,
    padding: 12,
    gap: 8,
  },
  sectionTitle: {color: C.text, fontWeight: '700'},
  linkBtn: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: C.bg,
  },
  linkBtnDisabled: {opacity: 0.55},
  linkText: {color: C.text, fontWeight: '700'},
  metaText: {color: C.textMuted, fontSize: 12},
  releaseWarning: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: C.warning || '#AA7A2A',
    borderRadius: 10,
    backgroundColor: '#FFF7E8',
    padding: 10,
    gap: 4,
  },
  releaseWarningTitle: {color: C.dark, fontWeight: '800', fontSize: 12},
  releaseWarningText: {color: C.textSub, fontSize: 12},
  forget: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: C.error,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  forgetTxt: {color: C.error, fontWeight: '800'},
});
